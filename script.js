
const graph = {
    A: ["B", "D"],
    B: ["A", "C", "E"],
    C: ["B", "F"],
    D: ["A", "E"],
    E: ["B", "D", "F"],
    F: ["C", "E"]
};

const positions = {
    A: [100, 60],
    B: [300, 60],
    C: [500, 60],
    D: [100, 270],
    E: [300, 270],
    F: [500, 270]
};

const edges = [
    ["A", "B"],
    ["A", "D"],
    ["B", "C"],
    ["B", "E"],
    ["C", "F"],
    ["D", "E"],
    ["E", "F"]
];

const svgNS = "http://www.w3.org/2000/svg";

const svg = document.getElementById("graph");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");

let running = false;
let runId = 0;
let animationId = null;
let timerId = null;

function makeSVG(tag, attributes = {}) {
    const element = document.createElementNS(svgNS, tag);

    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value);
    }

    return element;
}

// Draw graph edges, nodes and the orange marker
function drawGraph() {
    svg.innerHTML = "";

    edges.forEach(([a, b]) => {
        const [x1, y1] = positions[a];
        const [x2, y2] = positions[b];

        svg.appendChild(makeSVG("line", {
            x1, y1, x2, y2,
            id: edgeId(a, b),
            class: "edge"
        }));
    });

    Object.entries(positions).forEach(([name, [x, y]]) => {
        svg.appendChild(makeSVG("circle", {
            cx: x,
            cy: y,
            r: 25,
            id: "node-" + name,
            class: "node"
        }));

        const label = makeSVG("text", {
            x, y,
            class: "node-label"
        });

        label.textContent = name;
        svg.appendChild(label);
    });

    const marker = makeSVG("circle", {
        id: "movingNode",
        cx: positions.A[0],
        cy: positions.A[1],
        r: 12
    });

    marker.style.display = "none";
    svg.appendChild(marker);
}

function edgeId(a, b) {
    const edge = edges.find(([x, y]) =>
        (x === a && y === b) || (x === b && y === a)
    );

    return edge ? "edge-" + edge[0] + "-" + edge[1] : null;
}

function connected(a, b) {
    return graph[a].includes(b);
}

// BFS traversal order
function bfs(start) {
    const visited = new Set([start]);
    const queue = [start];
    const order = [];
    const parent = { [start]: null };

    while (queue.length) {
        const current = queue.shift();
        order.push(current);

        for (const neighbor of graph[current]) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                parent[neighbor] = current;
                queue.push(neighbor);
            }
        }
    }

    return { order, parent };
}

// DFS traversal order
function dfs(start) {
    const visited = new Set();
    const order = [];
    const parent = { [start]: null };

    function visit(node) {
        visited.add(node);
        order.push(node);

        for (const neighbor of graph[node]) {
            if (!visited.has(neighbor)) {
                parent[neighbor] = node;
                visit(neighbor);
            }
        }
    }

    visit(start);
    return { order, parent };
}

// Find a valid route through connected edges
function findPath(start, destination) {
    const queue = [start];
    const parent = { [start]: null };

    while (queue.length) {
        const current = queue.shift();

        if (current === destination) break;

        for (const neighbor of graph[current]) {
            if (!(neighbor in parent)) {
                parent[neighbor] = current;
                queue.push(neighbor);
            }
        }
    }

    if (!(destination in parent)) return [];

    const path = [];
    let current = destination;

    while (current !== null) {
        path.unshift(current);
        current = parent[current];
    }

    return path;
}

// Promise-based delay that can be cancelled with Reset
function pause(ms, id) {
    return new Promise(resolve => {
        timerId = setTimeout(() => {
            timerId = null;
            resolve(id === runId);
        }, ms);
    });
}

// Smoothly animate the orange marker along a single edge
function moveNode(from, to, duration, id) {
    return new Promise(resolve => {
        if (id !== runId || !connected(from, to)) {
            resolve(false);
            return;
        }

        const marker = document.getElementById("movingNode");
        const [x1, y1] = positions[from];
        const [x2, y2] = positions[to];

        const line = document.getElementById(edgeId(from, to));
        line.classList.add("active");

        const startTime = performance.now();

        function animate(now) {
            if (id !== runId) {
                resolve(false);
                return;
            }

            const progress = Math.min(
                (now - startTime) / duration, 1
            );

            // Smooth acceleration and deceleration
            const eased = progress * progress * (3 - 2 * progress);

            marker.setAttribute(
                "cx", x1 + (x2 - x1) * eased
            );

            marker.setAttribute(
                "cy", y1 + (y2 - y1) * eased
            );

            if (progress < 1) {
                animationId = requestAnimationFrame(animate);
            } else {
                animationId = null;
                resolve(true);
            }
        }

        animationId = requestAnimationFrame(animate);
    });
}

// Start automatic BFS or DFS traversal
async function startTraversal() {
    if (running) return;

    running = true;
    startBtn.disabled = true;

    const id = ++runId;

    const algorithm = document.getElementById("algorithm").value;
    const start = document.getElementById("startNode").value;
    const speed = Number(document.getElementById("speed").value);

    drawGraph();

    const marker = document.getElementById("movingNode");
    marker.style.display = "block";
    marker.setAttribute("cx", positions[start][0]);
    marker.setAttribute("cy", positions[start][1]);

    const result = algorithm === "BFS"
        ? bfs(start)
        : dfs(start);

    const order = result.order;
    const visitedOrder = [];

    document.getElementById("status").textContent =
        algorithm + " traversal is running...";

    document.getElementById("order").textContent = "None";

    for (let i = 0; i < order.length; i++) {
        if (id !== runId) return;

        const current = order[i];

        if (i > 0) {
            const previous = order[i - 1];

            // Use direct edge when available, otherwise follow
            // a valid route through the graph.
            const path = connected(previous, current)
                ? [previous, current]
                : findPath(previous, current);

            for (let j = 1; j < path.length; j++) {
                const moved = await moveNode(
                    path[j - 1],
                    path[j],
                    speed,
                    id
                );

                if (!moved || id !== runId) return;
            }
        }

        document.getElementById("node-" + current)
            .classList.add("visited");

        visitedOrder.push(current);

        document.getElementById("status").textContent =
            "Currently visiting node: " + current;

        document.getElementById("order").textContent =
            visitedOrder.join(" → ");

        const ok = await pause(250, id);

        if (!ok || id !== runId) return;
    }

    if (id === runId) {
        document.getElementById("status").textContent =
            algorithm + " traversal completed!";

        running = false;
        startBtn.disabled = false;
    }
}

// Stop animation and return the graph to its original state
function resetGraph() {
    runId++;

    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
    }

    running = false;
    startBtn.disabled = false;

    drawGraph();

    document.getElementById("status").textContent = "Ready to start";
    document.getElementById("order").textContent = "None";
}

startBtn.addEventListener("click", startTraversal);
resetBtn.addEventListener("click", resetGraph);

drawGraph();
