import csv
import random
import sys
from pathlib import Path

CATEGORIES = [
    ("Computer Science", "005"),
    ("Mathematics", "510"),
    ("Physics", "530"),
    ("Literature", "820"),
    ("History", "900"),
    ("Philosophy", "100"),
    ("Medicine", "610"),
    ("Art & Design", "700")
]

PUBLISHERS = [
    "O'Reilly Media", "MIT Press", "Addison-Wesley", "Oxford University Press",
    "Cambridge University Press", "Springer Nature", "Pearson Education", "Wiley"
]

FIRST_NAMES = ["Alice", "Brian", "Catherine", "David", "Elena", "Franklin", "Grace", "Henry", "Isabella", "James"]
LAST_NAMES = ["Knuth", "Turing", "Hopper", "Lovelace", "Shannon", "Dijkstra", "Lamport", "Ritchie", "Thompson", "Berners-Lee"]
ADJECTIVES = ["Advanced", "Foundations of", "Principles of", "Modern", "Essential", "Introduction to", "Handbook of", "Applied"]
NOUNS = ["Algorithms", "Quantum Mechanics", "Distributed Systems", "Data Structures", "Neural Networks", "Organic Chemistry", "Philosophy of Mind", "World History"]

def generate_isbn(idx: int) -> str:
    # Exactly 13 digits: 978 (3) + 1 digit (1) + 3 digits (3) + 5 digits (5) + 1 digit (1) = 13
    return f"978-0-{random.randint(100, 999)}-{idx:05d}-{random.randint(0, 9)}"

def generate_epc(idx: int) -> str:
    return f"E280110520{idx:014X}"

def main():
    target_path = Path(__file__).resolve().parent.parent / "data" / "synthetic_library_20000.csv"
    target_path.parent.mkdir(parents=True, exist_ok=True)

    total_count = 20000
    print(f"Generating {total_count} synthetic library records to {target_path}...")

    with open(target_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "isbn", "title", "author", "publisher", "publication_year",
            "dewey_decimal", "category", "accession_number", "rfid_epc", "shelf_location"
        ])

        for i in range(1, total_count + 1):
            cat, dewey_prefix = random.choice(CATEGORIES)
            title = f"{random.choice(ADJECTIVES)} {random.choice(NOUNS)} Vol {random.randint(1, 10)}"
            author = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
            publisher = random.choice(PUBLISHERS)
            year = random.randint(1990, 2024)
            dewey = f"{dewey_prefix}.{random.randint(10, 99)}"
            accession = f"ACC-20K-{i:05d}"
            epc = generate_epc(i)
            shelf = f"SHELF-{cat[:3].upper()}-{((i % 50) + 1):02d}"

            writer.writerow([
                generate_isbn(i), title, author, publisher, year, dewey, cat, accession, epc, shelf
            ])

        # Inject intentional duplicates and invalid rows for AC 01 verification
        print("Injecting intentional duplicate and invalid test rows for AC 01...")
        # 1. Duplicates of existing baseline records (ACC-10001 already in database)
        writer.writerow(["978-0131103627", "The C Programming Language (Dupe)", "Dennis Ritchie", "Prentice", 1988, "005.133", "Computer Science", "ACC-10001", "E280110520000001", "SHELF-CS-01"])
        writer.writerow(["978-0131103627", "Another Dupe of ACC-10001", "Dennis Ritchie", "Prentice", 1988, "005.133", "Computer Science", "ACC-10001", "E280110520000001", "SHELF-CS-01"])
        # 2. Malformed rows (missing title/author/invalid ISBN)
        writer.writerow(["INVALID-ISBN-12", "", "Missing Title Author", "Publisher", 2020, "000.0", "General", "BAD-ACC-01", "", "SHELF-01"])
        writer.writerow(["978-0000000000", "Missing Author Book", "", "Publisher", 2020, "000.0", "General", "BAD-ACC-02", "", "SHELF-01"])

    file_size_mb = target_path.stat().st_size / (1024 * 1024)
    print(f"Generated {total_count + 4} records ({file_size_mb:.2f} MB) successfully at {target_path}")

if __name__ == "__main__":
    main()
