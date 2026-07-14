# campus-navigation/backend/dijkstra.py
import heapq

def find_shortest_path(graph, start, end):
    """
    Finds the shortest path and its distance from a start node to an end node in a graph
    using Dijkstra's Algorithm implementation with a priority queue (heapq).
    """
    if start not in graph or end not in graph:
        return None, float('inf')
    
    if start == end:
        return [start], 0

    # Priority queue: stores tuples of (current_distance, current_node)
    pq = [(0, start)]
    # Dictionary to store the shortest discovered distance to each node
    distances = {node: float('inf') for node in graph}
    distances[start] = 0
    # Dictionary to reconstruct the path
    previous_nodes = {node: None for node in graph}

    while pq:
        current_distance, current_node = heapq.heappop(pq)

        # If we found shorter path earlier, ignore this one
        if current_distance > distances[current_node]:
            continue

        # If we reached the destination, we can optionally stop early
        if current_node == end:
            break

        # Explore neighbors
        for neighbor, weight in graph[current_node].items():
            distance = current_distance + weight

            # Only consider this new path if it's better than any path we've
            # already found.
            if distance < distances[neighbor]:
                distances[neighbor] = distance
                previous_nodes[neighbor] = current_node
                heapq.heappush(pq, (distance, neighbor))

    # Reconstruct path
    path = []
    current = end
    while current is not None:
        path.append(current)
        current = previous_nodes[current]
    
    path = path[::-1] # Reverse the path to get start -> end

    if path[0] == start:
        return path, distances[end]
    else:
        # No path found
        return [], float('inf')
