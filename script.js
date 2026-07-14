let graphData = {};
let coordinates = {};
let currentPath = [];

// Leaflet Map Variables
let map;
let markers = {}; 
let baselineEdges = []; 
let shortestPathPolyline = null; 

// Live Tracking Variables
let userLocationMarker = null;
let liveWatchId = null;
let isLiveNavigating = false;

// DOM Elements
const startSelect = document.getElementById('start-node');
const endSelect = document.getElementById('end-node');
const gpsBtn = document.getElementById('gps-btn');
const findPathBtn = document.getElementById('find-path-btn');
const fullTourBtn = document.getElementById('full-tour-btn');
const themeToggle = document.getElementById('theme-toggle');
const resultBox = document.getElementById('result-box');
const errorBox = document.getElementById('error-box');

const liveDashboard = document.getElementById('live-dashboard');
const startLiveBtn = document.getElementById('start-live-btn');
const walkingInstruction = document.getElementById('walking-instruction');
const liveDistance = document.getElementById('live-distance');
const liveTime = document.getElementById('live-time');

// Setup Dark/Light mode toggle
let isDarkTheme = false;
themeToggle.addEventListener('click', () => {
    isDarkTheme = !isDarkTheme;
    document.body.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
    themeToggle.textContent = isDarkTheme ? 'Light Mode' : 'Dark Mode';
});

// Initialize Leaflet Map
async function initMap() {
    // Basic initialization centered at Chandigarh University
    map = L.map('campus-map').setView([30.7675, 76.5745], 17);

    // Set the CartoDB Positron Tile Layer (Extremely stable, no 403 referrer blocks, beautiful UI)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CartoDB</a>'
    }).addTo(map);

    // Fetch the data from Python backend
    await fetchGraphData();
}

// Fetch Graph Data from Backend
async function fetchGraphData() {
    try {
        const res = await fetch('http://127.0.0.1:5000/api/graph-data');
        if (!res.ok) throw new Error('Backend not available. Make sure Flask app is running.');
        const data = await res.json();
        
        graphData = data.graph;
        coordinates = data.coordinates;
        
        populateDropdowns();
        renderGraphOnMap();
    } catch (err) {
        showError(err.message);
    }
}

// Populate Select Options
function populateDropdowns() {
    const nodes = Object.keys(graphData);
    startSelect.innerHTML = '';
    endSelect.innerHTML = '';
    
    nodes.forEach(node => {
        startSelect.add(new Option(node, node));
        endSelect.add(new Option(node, node));
    });
    
    if (nodes.length > 1) {
        endSelect.selectedIndex = 1;
    }
}

// Draw the entire graph on Leaflet Map
function renderGraphOnMap() {
    // 1. Add Markers for each node with direct labels
    for (const [node, pos] of Object.entries(coordinates)) {
        const marker = L.marker([pos.lat, pos.lng]).addTo(map)
            .bindTooltip(node, { permanent: true, direction: 'bottom', className: 'node-label' });
        markers[node] = marker;
    }

    // 2. Draw Baseline Edges (thin, gray) 
    // Disabled at user request to keep the map clean!
}

// Draw the Highlighted Shortest Path on REAL ROADS using OSRM
function highlightShortestPath(pathNodes) {
    // Remove existing highlighted path if any (it is a control now)
    if (shortestPathPolyline) {
        map.removeControl(shortestPathPolyline);
    }

    // Build coordinate sequence as Leaflet LatLng objects
    const pathCoords = pathNodes.map(node => L.latLng(coordinates[node].lat, coordinates[node].lng));

    // Create the Routing Machine control
    shortestPathPolyline = L.Routing.control({
        waypoints: pathCoords,
        router: L.Routing.osrmv1({
            profile: 'foot' // Instructs open street maps to strictly use pedestrian paths and sidewalks!
        }),
        lineOptions: {
            styles: [{color: '#ef4444', weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round'}],
            addWaypoints: false
        },
        show: false, // Suppresses the ugly default UI
        addWaypoints: false,
        routeWhileDragging: false,
        fitSelectedRoutes: true,
        createMarker: function() { return null; } // Prevent duplicate markers as we already drew them
    }).addTo(map);

    // Capture the physically accurate distance from the routing engine
    shortestPathPolyline.on('routesfound', function(e) {
        const routes = e.routes;
        if (routes && routes.length > 0) {
            const summary = routes[0].summary;
            document.getElementById('distance-output').textContent = summary.totalDistance.toFixed(0);
        }
    });
}

// Show Error UI
function showError(msg) {
    errorBox.style.display = 'block';
    resultBox.style.display = 'none';
    document.getElementById('error-output').textContent = msg;
}

// GPS Locate Closest Block
gpsBtn.addEventListener('click', () => {
    if ("geolocation" in navigator) {
        gpsBtn.textContent = '⏳';
        navigator.geolocation.getCurrentPosition((pos) => {
            const userLatLng = L.latLng(pos.coords.latitude, pos.coords.longitude);
            let closestNode = null;
            let minDistance = Infinity;
            
            // Find closest block
            for (const [node, coords] of Object.entries(coordinates)) {
                const dist = map.distance(userLatLng, L.latLng(coords.lat, coords.lng));
                if (dist < minDistance) {
                    minDistance = dist;
                    closestNode = node;
                }
            }
            
            if (closestNode) {
                startSelect.value = closestNode;
                gpsBtn.textContent = '📍';
            }
        }, (err) => {
            alert('Failed to access GPS. Please ensure Location is enabled for your browser.');
            gpsBtn.textContent = '📍';
        }, { enableHighAccuracy: true });
    } else {
        alert("Your device doesn't support GPS.");
    }
});

// Fetch Shortest Path Action
findPathBtn.addEventListener('click', async () => {
    const startNode = startSelect.value;
    const endNode = endSelect.value;
    
    if (startNode === endNode) {
        showError("Source and Destination cannot be the same!");
        return;
    }
    
    try {
        errorBox.style.display = 'none';
        
        const res = await fetch('http://127.0.0.1:5000/api/shortest-path', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ start: startNode, end: endNode })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || "Failed to fetch path");
        }
        
        currentPath = data.path;
        
        // Display Result Interface
        resultBox.style.display = 'block';
        document.getElementById('distance-output').textContent = data.distance;
        
        // Build path output text
        const pathOutput = document.getElementById('path-output');
        pathOutput.innerHTML = ''; 
        
        data.path.forEach((node, index) => {
            const span = document.createElement('span');
            span.textContent = node;
            pathOutput.appendChild(span);
            
            if (index < data.path.length - 1) {
                const arrow = document.createElement('span');
                arrow.className = 'path-arrow';
                arrow.innerHTML = '&#8594;'; 
                pathOutput.appendChild(arrow);
            }
        });
        
        // Hide all irrelevant markers (keep only Source and Destination)
        Object.keys(markers).forEach(node => {
            if (node === startNode || node === endNode) {
                // Ensure it's on the map
                if (!map.hasLayer(markers[node])) {
                    markers[node].addTo(map);
                }
            } else {
                // Remove irrelevant markers from view
                if (map.hasLayer(markers[node])) {
                    map.removeLayer(markers[node]);
                }
            }
        });
        
        // highlight the route
        highlightShortestPath(data.path);
        
    } catch (err) {
        showError(err.message);
    }
});

// Full Campus Tour Logic
fullTourBtn.addEventListener('click', async () => {
    // The designated nodes to tour the full university
    const tourSequence = ["Zakir A", "NC 1", "B1", "A1", "D1"];
    let finalPath = [];
    
    errorBox.style.display = 'none';

    try {
        for(let i=0; i<tourSequence.length-1; i++) {
            const startNode = tourSequence[i];
            const endNode = tourSequence[i+1];
            
            if(!graphData[startNode] || !graphData[endNode]) continue;

            const res = await fetch('http://127.0.0.1:5000/api/shortest-path', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ start: startNode, end: endNode })
            });
            const data = await res.json();
            
            if (data.path) {
                if (finalPath.length > 0 && finalPath[finalPath.length-1] === data.path[0]) {
                    data.path.shift(); // Remove duplicate connecting node
                }
                finalPath = finalPath.concat(data.path);
            }
        }
        
        currentPath = finalPath;
        
        // Display Result Interface
        resultBox.style.display = 'block';
        document.getElementById('distance-output').textContent = "Calculating OSRM Route...";
        
        // Build path output text
        const pathOutput = document.getElementById('path-output');
        pathOutput.innerHTML = ''; 
        
        finalPath.forEach((node, index) => {
            const span = document.createElement('span');
            span.textContent = node;
            pathOutput.appendChild(span);
            
            if (index < finalPath.length - 1) {
                const arrow = document.createElement('span');
                arrow.className = 'path-arrow';
                arrow.innerHTML = '&#8594;'; 
                pathOutput.appendChild(arrow);
            }
        });
        
        highlightShortestPath(finalPath);
        
    } catch (err) {
        showError(err.message);
    }
});

// Fetch Init
document.addEventListener("DOMContentLoaded", () => {
    initMap();
});

// --- Live Navigation Logic ---
startLiveBtn.addEventListener('click', () => {
    if (isLiveNavigating) {
        stopLiveNavigation();
        return;
    }
    
    if (!currentPath || currentPath.length === 0) {
        alert("Please calculate a shortest path first before starting navigation!");
        return;
    }
    
    if ("geolocation" in navigator) {
        startLiveBtn.innerHTML = "<span>Stop Navigation</span>";
        startLiveBtn.style.background = "#ef4444";
        liveDashboard.style.display = "block";
        isLiveNavigating = true;
        
        liveWatchId = navigator.geolocation.watchPosition(updateLiveTracker, 
        (err) => {
            alert("Error grabbing GPS. Are location services enabled?");
            stopLiveNavigation();
        }, { enableHighAccuracy: true });
    } else {
        alert("Geolocation is not supported by your browser");
    }
});

function stopLiveNavigation() {
    isLiveNavigating = false;
    liveDashboard.style.display = "none";
    startLiveBtn.innerHTML = "<span>Start Live Route Tracker</span>";
    startLiveBtn.style.background = "#10b981";
    if (liveWatchId !== null) navigator.geolocation.clearWatch(liveWatchId);
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
        userLocationMarker = null;
    }
}

function updateLiveTracker(position) {
    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;
    const userLatLng = L.latLng(userLat, userLng);
    
    // Render/update the Blue Dot (Live Location)
    if (!userLocationMarker) {
        userLocationMarker = L.circleMarker(userLatLng, {
            radius: 8, fillColor: "#3b82f6", color: "#ffffff",
            weight: 3, opacity: 1, fillOpacity: 1
        }).addTo(map);
    } else {
        userLocationMarker.setLatLng(userLatLng);
    }

    // Auto-pan very slightly if tracking
    map.panTo(userLatLng, {animate: true, duration: 1.0});

    // 1. Determine active path destination (We track to the FIRST node of currentPath, and then entire polyline)
    if (currentPath.length > 0) {
        const nextTargetNode = currentPath[0];
        const nextTargetLatLng = L.latLng(coordinates[nextTargetNode].lat, coordinates[nextTargetNode].lng);
        
        // 2. Calculate dynamic distance using Leaflet map.distance (Haversine meters)
        let totalRemainingMeters = map.distance(userLatLng, nextTargetLatLng);
        
        // Add rest of the route
        for (let i = 0; i < currentPath.length - 1; i++) {
            const nodeA = L.latLng(coordinates[currentPath[i]].lat, coordinates[currentPath[i]].lng);
            const nodeB = L.latLng(coordinates[currentPath[i+1]].lat, coordinates[currentPath[i+1]].lng);
            totalRemainingMeters += map.distance(nodeA, nodeB);
        }
        // *Note we use map.distance here for instant live tracking speed rather than querying OSRM 
        // 5 times a second which would overload the free public API limit!

        // 3. Update Dashboard Strings
        const kmLeft = (totalRemainingMeters / 1000).toFixed(2);
        liveDistance.textContent = `${kmLeft} km`;
        
        // Walking assumption: Flat ground 5km/hr (approx 83.3 meters a minute)
        const totalMinutes = Math.ceil(totalRemainingMeters / 83.3);
        liveTime.textContent = `${totalMinutes} min walk`;
        
        walkingInstruction.textContent = `Heading to ${currentPath[currentPath.length-1]}`;
        
        // Success Condition! 
        if (totalRemainingMeters < 15) { // within 15 meters
            walkingInstruction.textContent = `You have arrived!`;
            stopLiveNavigation();
        }
    }
}

// --- Category Filtering Logic ---
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Toggle Active UI States
        document.querySelectorAll('.filter-btn').forEach(b => {
            b.style.background = 'rgba(255,255,255,0.2)';
            b.style.fontWeight = '400';
        });
        btn.style.background = '#3b82f6';
        btn.style.fontWeight = '600';
        
        const selectedCategory = btn.getAttribute('data-category');
        
        // Loop through all nodes and toggle marker visibility based on category
        Object.keys(markers).forEach(node => {
            // Re-fetch category safely from backend payload
            const nodeCategory = coordinates[node].category || "Other";
            
            if (selectedCategory === "All" || nodeCategory === selectedCategory) {
                // Show
                if (!map.hasLayer(markers[node])) markers[node].addTo(map);
            } else {
                // Hide
                if (map.hasLayer(markers[node])) map.removeLayer(markers[node]);
            }
        });
    });
});
