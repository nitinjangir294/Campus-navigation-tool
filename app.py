# campus-navigation/backend/app.py
from flask import Flask, jsonify, request
from flask_cors import CORS
from dijkstra import find_shortest_path
from data import GRAPH, COORDINATES

app = Flask(__name__)
# Enable CORS for cross-origin requests from the frontend
CORS(app)

@app.route('/api/graph-data', methods=['GET'])
def get_graph_data():
    """
    Endpoint to retrieve graph data (nodes, edges, coordinates) 
    for the frontend visualization.
    """
    return jsonify({
        "graph": GRAPH,
        "coordinates": COORDINATES
    })

@app.route('/api/shortest-path', methods=['POST'])
def perform_dijkstra():
    """
    Calculates the shortest path using Dijkstra's algorithm.
    Expects JSON payload: {"start": "NodeA", "end": "NodeB"}
    """
    data = request.json
    start_node = data.get('start')
    end_node = data.get('end')

    if not start_node or not end_node:
        return jsonify({"error": "Start and End locations are required"}), 400
    
    if start_node == end_node:
        return jsonify({"error": "Start and End locations cannot be the same"}), 400

    path, distance = find_shortest_path(GRAPH, start_node, end_node)

    if not path:
        return jsonify({"error": f"No path found from {start_node} to {end_node}."}), 404

    return jsonify({
        "path": path,
        "distance": distance
    })

if __name__ == '__main__':
    # Run the Flask server
    app.run(debug=True, port=5000)
