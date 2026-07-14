import pandas as pd
import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return int(2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a)))


df = pd.read_excel("LOCATION DATA.xlsx", header=None)

coordinates = {}

# ---------------------------
# STEP 1: READ COORDINATES
# ---------------------------
for _, row in df.iterrows():
    try:
        lat, lng = map(float, str(row[0]).split(','))
        name = str(row[1]).strip()

        category = "Other"
        if len(row) > 2 and str(row[2]) != 'nan':
            category = str(row[2]).strip()

        coordinates[name] = {
            "lat": lat,
            "lng": lng,
            "category": category
        }
    except:
        continue


# ---------------------------
# STEP 2: BUILD GRAPH (SAFE)
# ---------------------------
graph = {node: {} for node in coordinates}

nodes = list(coordinates.keys())

for node_a in nodes:
    distances = []

    for node_b in nodes:
        if node_a != node_b:
            dist = haversine(
                coordinates[node_a]["lat"], coordinates[node_a]["lng"],
                coordinates[node_b]["lat"], coordinates[node_b]["lng"]
            )
            distances.append((dist, node_b))

    distances.sort(key=lambda x: x[0])

    # ✅ ONLY 3 nearest neighbors (realistic)
    for dist, node_b in distances[:3]:
        graph[node_a][node_b] = dist
        graph[node_b][node_a] = dist   # 🔥 IMPORTANT


# ---------------------------
# STEP 3: SAVE FILE
# ---------------------------
with open("data.py", "w") as f:
    f.write("GRAPH = {\n")
    for node, edges in graph.items():
        f.write(f"    '{node}': {edges},\n")
    f.write("}\n\n")

    f.write("COORDINATES = {\n")
    for node, coord in coordinates.items():
        f.write(f"    '{node}': {coord},\n")
    f.write("}\n")

print("✅ Clean graph generated successfully!")