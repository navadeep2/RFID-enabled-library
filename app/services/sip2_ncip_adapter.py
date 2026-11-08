import re
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from app.services.circulation import checkout_item, checkin_item, renew_item
from app.services.catalog import get_item_by_identifier
from app.services.audit import record_audit

class SIP2Parser:
    """
    Parses and builds standard 3M SIP2 messages according to the protocol specification.
    """
    @staticmethod
    def parse_field(message: str, field_id: str) -> Optional[str]:
        # SIP2 variable fields are formatted as: <field_id><value>| (delimited by |)
        pattern = rf"{field_id}(.*?)(?:\||$)"
        match = re.search(pattern, message)
        return match.group(1) if match else None

    @classmethod
    def process_message(cls, raw: str, db_path: Optional[str] = None) -> str:
        clean = raw.strip()
        if not clean:
            return "96" # Error / unknown

        msg_type = clean[:2]
        now_str = datetime.now(timezone.utc).strftime("%Y%m%d    %H%M%S")

        # 93 - Login
        if msg_type == "93":
            # Response: 941 (94 = Login response, 1 = success)
            return "941"

        # 11 - Item Information
        elif msg_type == "11":
            # 11<date><item_id>
            item_id = clean[20:].strip()
            # If item_id has subfields like AB...
            if "AB" in item_id:
                item_id = cls.parse_field(item_id, "AB") or item_id

            item = get_item_by_identifier(item_id, db_path)
            if not item:
                # 12 <circ_status 01=other> <security_marker 00=other> <fee_type 01=other>
                return f"12010001{now_str}AB{item_id}|AJItem Not Found|"

            circ_status = "02" if item["status"] == "ISSUED" else "03"
            sec_marker = "01" if item["security_bit"] == 1 else "00"
            return f"12{circ_status}{sec_marker}01{now_str}AB{item['accession_number']}|AJ{item['title']}|CK001|"

        # 17 - Checkout
        elif msg_type == "17":
            # Expects patron identifier AA and item identifier AB
            patron_id = cls.parse_field(clean, "AA") or "MEM-101"
            item_id = cls.parse_field(clean, "AB") or ""
            try:
                result = checkout_item(
                    member_code=patron_id,
                    item_identifier=item_id,
                    checkout_method="SIP2",
                    db_path=db_path
                )
                # 18 <ok=1> <renewal_ok=0> <magnetic=N> <desensitize=Y> <date> AA<patron>|AB<item>|AJ<title>|AH<due_date>|
                return f"181NY{now_str}AA{patron_id}|AB{item_id}|AJ{result['item_title']}|AH{result['due_date']}|"
            except Exception as e:
                # 180 = Failed checkout
                return f"180NN{now_str}AA{patron_id}|AB{item_id}|AF{str(e)}|"

        # 09 - Checkin
        elif msg_type == "09":
            item_id = cls.parse_field(clean, "AB") or clean[20:].strip()
            try:
                result = checkin_item(item_identifier=item_id, db_path=db_path)
                # 10 <ok=1> <resensitize=Y> <magnetic=N> <alert=N> <date> AB<item>|AJ<title>|
                return f"101YN{now_str}AB{item_id}|AJ{result['item_title']}|"
            except Exception as e:
                return f"100NN{now_str}AB{item_id}|AF{str(e)}|"

        # 29 - Renew
        elif msg_type == "29":
            item_id = cls.parse_field(clean, "AB") or ""
            try:
                result = renew_item(item_identifier=item_id, db_path=db_path)
                return f"301NY{now_str}AB{item_id}|AJ{result['item_title']}|AH{result['new_due_date']}|"
            except Exception as e:
                return f"300NN{now_str}AB{item_id}|AF{str(e)}|"

        return "96" # Unsupported message type

# NCIP 2.0 JSON Message Processor
class NCIP2Adapter:
    @staticmethod
    def process_ncip_request(action: str, payload: Dict[str, Any], db_path: Optional[str] = None) -> Dict[str, Any]:
        action_clean = action.strip()
        timestamp = datetime.now(timezone.utc).isoformat()

        if action_clean == "LookupItem":
            item_id = payload.get("ItemId") or payload.get("rfid_epc") or ""
            item = get_item_by_identifier(item_id, db_path)
            if not item:
                return {
                    "Problem": {
                        "ProblemType": "ItemNotFound",
                        "ProblemDetail": f"Item '{item_id}' not found in catalog"
                    }
                }
            return {
                "LookupItemResponse": {
                    "ItemId": item["accession_number"],
                    "ItemOptionalFields": {
                        "BibliographicDescription": {
                            "Title": item["title"],
                            "Author": item["author"],
                            "ISBN": item["isbn"]
                        },
                        "ItemStatus": item["status"],
                        "SecurityMarker": "Active" if item["security_bit"] == 1 else "Inactive",
                        "Location": item["shelf_location"]
                    }
                }
            }

        elif action_clean == "CheckOutItem":
            patron_id = payload.get("UserId")
            item_id = payload.get("ItemId")
            try:
                res = checkout_item(
                    member_code=patron_id,
                    item_identifier=item_id,
                    checkout_method="NCIP_2.0",
                    db_path=db_path
                )
                return {
                    "CheckOutItemResponse": {
                        "ItemId": res["accession_number"],
                        "UserId": patron_id,
                        "DueDate": res["due_date"],
                        "SecurityMarker": "Desensitized",
                        "Success": True
                    }
                }
            except Exception as e:
                return {
                    "Problem": {
                        "ProblemType": "CheckOutFailed",
                        "ProblemDetail": str(e)
                    }
                }

        elif action_clean == "CheckInItem":
            item_id = payload.get("ItemId")
            try:
                res = checkin_item(item_identifier=item_id, db_path=db_path)
                return {
                    "CheckInItemResponse": {
                        "ItemId": res["accession_number"],
                        "SecurityMarker": "Resensitized",
                        "FineAccrued": res["fine_accrued"],
                        "Success": True
                    }
                }
            except Exception as e:
                return {
                    "Problem": {
                        "ProblemType": "CheckInFailed",
                        "ProblemDetail": str(e)
                    }
                }

        return {
            "Problem": {
                "ProblemType": "UnsupportedAction",
                "ProblemDetail": f"Action '{action}' is not supported"
            }
        }
