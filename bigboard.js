document.addEventListener("DOMContentLoaded", async () => {
    const username = localStorage.getItem("usuarioActual");
    const favoritosKey = `favoritos_${username}`;
    const listaBigBoard = document.getElementById("lista-big-board");

    // Procesar contenido TSV
    function procesarTSV(data) {
        const rows = data.split("\n").filter(Boolean);
        const headers = rows[0].split("\t").map(header => header.trim());

        return rows.slice(1).map(row => {
            const values = row.split("\t").map(value => value.trim());
            const jugador = {};
            headers.forEach((header, index) => {
                jugador[header] = values[index];
            });
            return jugador;
        }).filter(jugador => jugador["Nombre"]);
    }

    // Leer archivo TSV
    async function obtenerJugadores() {
        try {
            const response = await fetch('jugadores.tsv');
            if (!response.ok) throw new Error("No se pudo cargar el archivo TSV.");

            const tsvData = await response.text();
            return procesarTSV(tsvData);
        } catch (error) {
            console.error("Error al obtener jugadores:", error);
            return [];
        }
    }

    // Obtener calificación desde localStorage
    function obtenerCalificacion(notaKey) {
        const calificacionesKey = `calificaciones_${username}`;
        const calificaciones = JSON.parse(localStorage.getItem(calificacionesKey)) || {};
        return calificaciones[notaKey] || 0; // Por defecto, 0 estrellas
    }

    // Guardar calificación en localStorage
    function guardarCalificacion(notaKey, calificacion) {
        const calificacionesKey = `calificaciones_${username}`;
        let calificaciones = JSON.parse(localStorage.getItem(calificacionesKey)) || {};
        calificaciones[notaKey] = parseInt(calificacion);
        localStorage.setItem(calificacionesKey, JSON.stringify(calificaciones));
    }

    // Obtener notas desde localStorage
    function obtenerNota(notaKey) {
        return localStorage.getItem(notaKey) || "Sin notas";
    }

    // Renderizar solo los jugadores favoritos
    async function renderBigBoard() {
        const jugadores = await obtenerJugadores();
        const favoritos = JSON.parse(localStorage.getItem(favoritosKey)) || [];
        listaBigBoard.innerHTML = "";

        const jugadoresFavoritos = favoritos
            .map(id => jugadores.find(jugador => `${jugador["Nombre"]}_${jugador["Apellido Paterno"]}` === id))
            .filter(Boolean);

        jugadoresFavoritos.forEach((jugador, index) => {
            const nombreCompleto = `${jugador["Nombre"]} ${jugador["Apellido Paterno"] || ""}`.trim();
            const posicionOFF = jugador["Posición Principal"] || "Sin posición";
            const posicionDEF = jugador["Posición Defensiva"] || "Sin posición";
            const carpeta = jugador["Carpeta"] || "imagenes/default.jpg"; // Ruta de la imagen
            const notaKey = `${username}_${jugador["Nombre"]}_${jugador["Apellido Paterno"]}`;
            const calificacion = obtenerCalificacion(notaKey); // 1 a 5 estrellas
            const nota = obtenerNota(notaKey);

            const board = document.createElement("div");
            board.className = "jugador-board";
            board.setAttribute("draggable", true);
            board.setAttribute("data-index", index);

            // Agregar eventos de arrastrar y soltar
            board.addEventListener("dragstart", (e) => {
                e.dataTransfer.setData("text/plain", index);
                board.classList.add("dragging");
            });
            board.addEventListener("dragover", (e) => {
                e.preventDefault();
                const draggingBoard = document.querySelector(".dragging");
                if (draggingBoard !== board) {
                    const rect = board.getBoundingClientRect();
                    const offset = e.clientY - rect.top;
                    if (offset > rect.height / 2) {
                        listaBigBoard.insertBefore(draggingBoard, board.nextSibling);
                    } else {
                        listaBigBoard.insertBefore(draggingBoard, board);
                    }
                }
            });
            board.addEventListener("dragend", () => {
                board.classList.remove("dragging");
                const newOrder = Array.from(listaBigBoard.children).map(child => {
                    const idx = child.getAttribute("data-index");
                    return favoritos[idx];
                });
                localStorage.setItem(favoritosKey, JSON.stringify(newOrder));
            });

            board.innerHTML = `
                <img src="${carpeta}" alt="${nombreCompleto}" class="bigboard-imagen">
                <div class="bigboard-info">
                    <h3>
                        <a href="perfil.html?nombre=${encodeURIComponent(jugador["Nombre"])}&apellido=${encodeURIComponent(jugador["Apellido Paterno"])}" class="perfil-link">
                            ${nombreCompleto}
                        </a>
                    </h3>
                    <p>Posición Principal: ${posicionOFF}</p>
                    <p>Altura: ${jugador["Altura"] || "Sin altura"}</p>
                    <p>Calificación: ${"★".repeat(calificacion)}${"☆".repeat(5 - calificacion)}</p>
                    <p>Notas: ${nota}</p>
                </div>
            `;

            listaBigBoard.appendChild(board);
        });
    }

    // Agregar un observador para actualizar el BigBoard dinámicamente
    window.addEventListener("storage", (event) => {
        if (event.key === favoritosKey) {
            renderBigBoard();
        }
    });

    renderBigBoard();
});


















  
  
  
  


  
  
  