import os

class XERParser:
    """
    Parses Primavera P6 XER files using standard tab delimiters.
    Specifically pulls the %T PROJWBS table to extract WBS hierarchy and nodes.
    """
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.tables = {}

    def parse(self):
        if not os.path.exists(self.file_path):
            raise FileNotFoundError(f"XER file not found at {self.file_path}")

        current_table = None
        headers = []

        with open(self.file_path, "r", encoding="latin-1") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                
                # Check table markers
                if line.startswith("%T"):
                    current_table = line.split("\t")[1].strip()
                    self.tables[current_table] = []
                    headers = []
                elif line.startswith("%F") and current_table:
                    headers = [h.strip() for h in line.split("\t")[1:]]
                elif line.startswith("%R") and current_table and headers:
                    row_data = [r.strip() for r in line.split("\t")[1:]]
                    # Map headers to row data
                    record = {}
                    for idx, header in enumerate(headers):
                        if idx < len(row_data):
                            record[header] = row_data[idx]
                        else:
                            record[header] = None
                    self.tables[current_table].append(record)
        return self.tables

    def get_wbs_nodes(self):
        if not self.tables:
            self.parse()
        
        proj_wbs = self.tables.get("PROJWBS", [])
        nodes = []
        for row in proj_wbs:
            wbs_id = row.get("wbs_id")
            wbs_short_name = row.get("wbs_short_name")
            wbs_name = row.get("wbs_name")
            parent_wbs_id = row.get("parent_wbs_id")

            # Clean and parse types
            nodes.append({
                "id": int(wbs_id) if wbs_id else None,
                "code": wbs_short_name,
                "name": wbs_name,
                "parent_id": int(parent_wbs_id) if parent_wbs_id and parent_wbs_id != "0" else None
            })
        return nodes
