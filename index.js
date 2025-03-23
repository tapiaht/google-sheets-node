const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const app = express();
require("dotenv").config();
app.use(bodyParser.json());

const fs = require("fs");
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64) {
  const jsonFilePath = "/tmp/google-key.json"; // Ruta temporal en Railway
  fs.writeFileSync(jsonFilePath, Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, "base64").toString("utf-8"));
  
  // Configurar la variable GOOGLE_APPLICATION_CREDENTIALS
  process.env.GOOGLE_APPLICATION_CREDENTIALS = jsonFilePath;
  console.log("✅ Clave de Google decodificada y guardada en:", jsonFilePath);
} else {
  console.error("❌ No se encontró GOOGLE_APPLICATION_CREDENTIALS_BASE64");
}
// Cargar credenciales
//const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  //credentials: credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// ID de la hoja de Google Sheets
const SPREADSHEET_ID = "15LdTnxKc1bNoWqhsYy9-B5YC2dh05RLlJrzFKQpuZhs";

// Ruta para obtener los alumnos por curso
app.get("/api/get-alumnos-por-curso", async (req, res) => {
  const curso = req.query.curso;  // Recibimos el curso desde la consulta

  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });
    
    let grado=curso
    grado=grado.replace(' ', '');
    // Leer directamente la hoja del curso
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${grado}!A2:D`,  // Asume que cada curso tiene su propia hoja
    });

    const rows = response.data.values;
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "No se encontraron alumnos para este curso" });
    }

    res.json({ data: rows });  // Enviar todos los alumnos encontrados en la hoja correspondiente
  } catch (error) {
    console.error("Error al obtener los alumnos:", error);
    res.status(500).json({ error: "Error al obtener los alumnos" });
  }
});


// Ruta para cargar las notas a Google Sheets
// app.post("/api/cargar-notas", async (req, res) => {
//   const data = req.body.data;  // Datos de las calificaciones desde Excel
//   const curso = req.body.curso;  // Curso seleccionado
  
//   try {
//       const client = await auth.getClient();
//       const sheets = google.sheets({ version: "v4", auth: client });
      
//       // Verificar si hay datos
//       if (!data || data.length === 0) {
//           return res.status(400).json({ error: "No se han recibido datos válidos" });
//       }
      
//       // Determinar la hoja correspondiente al curso (Ejemplo: PRIMEROA, SEGUNDOB, etc.)
//       let grado = curso
//       grado = grado.replace(' ', '');
//       // Leer datos de la hoja específica
//       console.log(grado)
//       const response = await sheets.spreadsheets.values.get({
//           spreadsheetId: SPREADSHEET_ID,
//           range: `${grado}!A2:G`,  // Leer desde la fila 2
//       });
      
//       const alumnos = response.data.values;
//       if (!alumnos) {
//           return res.status(400).json({ error: "No se encontraron datos en la hoja de Google Sheets" });
//       }
      
//       const actualizarNotas = [];
      
//       // Comparar estudiantes y preparar las actualizaciones
//       for (const alumno of alumnos) {
//           const alumnoEnExcel = data.find(row => row[0] === alumno[0]);
          
//           if (alumnoEnExcel) {
//               const index = alumnos.indexOf(alumno);  // Índice del alumno en la hoja
              
//               actualizarNotas.push({
//                   range: `${grado}!E${index + 2}:H${index + 2}`, // Actualiza notas en columnas E-H
//                   values: [[
//                       alumnoEnExcel[2] || '',
//                       alumnoEnExcel[3] || '',
//                       alumnoEnExcel[4] || '',
//                       alumnoEnExcel[5] || ''
//                   ]],
//               });
//           }
//       }
      
//       // Realizar la actualización en un solo batchUpdate
//       if (actualizarNotas.length > 0) {
//           await sheets.spreadsheets.values.batchUpdate({
//               spreadsheetId: SPREADSHEET_ID,
//               requestBody: {
//                   data: actualizarNotas,
//                   valueInputOption: "RAW"
//               }
//           });
//       }
      
//       res.status(200).json({ message: "Notas actualizadas correctamente en Google Sheets" });
//   } catch (error) {
//       console.error("Error al cargar las notas:", error);
//       res.status(500).json({ error: "Error cargando las notas" });
//   }
// });
function getExcelColumnLetter(index) {
  let columnLetter = "";
  while (index >= 0) {
      columnLetter = String.fromCharCode((index % 26) + 65) + columnLetter;
      index = Math.floor(index / 26) - 1;
  }
  return columnLetter;
}

// Función para obtener la letra de la columna de Excel
// function getExcelColumnLetter(col) {
//   let temp;
//   let letter = '';
//   while (col >= 0) {
//     temp = col % 26;
//     letter = String.fromCharCode(temp + 65) + letter;
//     col = Math.floor(col / 26) - 1;
//   }
//   return letter;
// }
app.post("/api/cargar-notas", async (req, res) => {
    const data = req.body.data;  // Datos de calificaciones desde Excel
    const curso = req.body.curso;  // Curso seleccionado
    const trimestre = req.body.trimestre; // Trimestre seleccionado (1, 2 o 3)
    const materia = req.body.materia; // Materia seleccionada

    try {
        const client = await auth.getClient();
        const sheets = google.sheets({ version: "v4", auth: client });

        // Verificar si hay datos
        if (!data || data.length === 0) {
            return res.status(400).json({ error: "No se han recibido datos válidos" });
        }

        // Determinar la hoja del curso (Ejemplo: PRIMEROA, SEGUNDOB, etc.)
        let grado = curso.replace(" ", "");
        console.log("Procesando curso:", grado);

        // Obtener todas las columnas de la primera fila para ubicar la correcta
        const headerResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${grado}!A1:1`,  // Se asume que la fila 1 contiene los títulos de las columnas
        });

        const headers = headerResponse.data.values[0]; // Lista de nombres de columnas

        // Buscar la columna donde se guardarán las notas de la materia/trimestre
        const tituloColumna = `${materia}${trimestre}`; // Ejemplo: MAT1, CSO2, FIS3, etc.
        const columnaIndex = headers.indexOf(tituloColumna); 
        console.log("TituloColumna:", tituloColumna);
        console.log("columnaIndex:", columnaIndex);
        if (columnaIndex === -1) {
            return res.status(400).json({ error: `No se encontró la columna para ${materia} en el trimestre ${trimestre}` });
        }

        // Convertir el índice de columna numérico a formato A-Z en Excel
        //const letraColumna = String.fromCharCode(65 + columnaIndex); // 65 = 'A'
        const letraColumna = getExcelColumnLetter(columnaIndex)
        console.log(`📌 Materia: ${materia}, Trimestre: ${trimestre}, Columna: ${letraColumna}`);

        // Obtener los alumnos del curso desde la hoja de Google Sheets
        const alumnosResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${grado}!A2:A`,  // Obtener solo los IDs de alumnos
        });

        const alumnos = alumnosResponse.data.values.flat(); // Convertimos en un array plano

        if (!alumnos || alumnos.length === 0) {
            return res.status(400).json({ error: "No se encontraron alumnos en la hoja" });
        }

        const actualizarNotas = [];

        // Comparar alumnos y actualizar notas
        for (const alumnoEnExcel of data) {
            const index = alumnos.indexOf(alumnoEnExcel[0]); // Buscar por ID

            if (index !== -1) { // Si se encuentra el alumno
                actualizarNotas.push({
                    range: `${grado}!${letraColumna}${index + 2}`, // Celda específica
                    values: [[alumnoEnExcel[1] || '']], // Calificación del alumno
                });
            }
        }

        // Enviar actualización en batch
        if (actualizarNotas.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    data: actualizarNotas,
                    valueInputOption: "RAW"
                }
            });
        }

        res.status(200).json({ message: "Notas actualizadas correctamente en Google Sheets" });
    } catch (error) {
        console.error("❌ Error al cargar las notas:", error);
        res.status(500).json({ error: "Error cargando las notas" });
    }
});

  
// Ruta para obtener todas las notas desde Google Sheets
app.get("/api/obtener-notas", async (req, res) => {
  const curso = req.query.curso;  // El curso se recibe en la consulta

  if (!curso) {
    return res.status(400).json({ error: "El curso es obligatorio" });
  }

  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });
    let grado=curso
    grado=grado.replace(' ', '');
    // Leer directamente la hoja del curso
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${grado}!A2:H`,  // Ajustado para que tome el curso correcto
      
    });

    const rows = response.data.values;
    console.log("Datos recuperados de Google Sheets:", JSON.stringify(rows, null, 2));

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: `No se encontraron notas para el curso ${grado}` });
    }
// Evitar el caché en la respuesta
res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
res.setHeader("Pragma", "no-cache");
res.setHeader("Expires", "0");

    res.json({ data: rows });
  } catch (error) {
    console.error("Error al obtener las notas:", error);
    res.status(500).json({ error: "Error al obtener las notas" });
  }
});

app.get("/api/obtener-notas-trimestre-materia", async (req, res) => {
  const curso = req.query.curso; // Curso (ejemplo: Primero A)
  const trimestre = req.query.trimestre; // Trimestre (1, 2 o 3)
  const materia = req.query.materia; // Materia (MAT, CSO, etc.)

  try {
      const client = await auth.getClient();
      const sheets = google.sheets({ version: "v4", auth: client });

      if (!curso || !trimestre || !materia) {
          return res.status(400).json({ error: "Faltan parámetros (curso, trimestre o materia)" });
      }

      // Determinar la hoja del curso (Ejemplo: PRIMEROA, SEGUNDOB, etc.)
      let grado = curso.replace(" ", "").toUpperCase();
      console.log(`📌 Obteniendo notas de: Curso: ${grado}, Materia: ${materia}, Trimestre: ${trimestre}`);

      // Obtener encabezados de la hoja (Fila 1)
      const headerResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${grado}!A1:1`, // Primera fila con títulos
      });

      const headers = headerResponse.data.values[0];

      // Buscar la columna de la materia y trimestre
      const tituloColumna = `${materia}${trimestre}`; // Ejemplo: MAT1, CSO2, FIS3, etc.
      const columnaIndex = headers.indexOf(tituloColumna);

      if (columnaIndex === -1) {
          return res.status(400).json({ error: `No se encontró la columna de ${materia} en el trimestre ${trimestre}` });
      }

      // Convertir índice numérico en letra de Excel
      const letraColumna = getExcelColumnLetter(columnaIndex);
      console.log(`📌 Columna encontrada: ${letraColumna}`);

      // Obtener nombres y notas de alumnos
      const alumnosResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${grado}!A2:D`, // A = ID, B = Nombre
      });

      const notasResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${grado}!${letraColumna}2:${letraColumna}`, // Notas desde la fila 2
      });

      const alumnos = alumnosResponse.data.values || [];
      const notas = notasResponse.data.values || [];

      if (alumnos.length === 0) {
          return res.status(400).json({ error: "No se encontraron alumnos" });
      }

      // Unir alumnos con sus notas
      const resultado = alumnos.map((alumno, index) => ({
          id: alumno[0], // ID del alumno
          nombre: alumno[3], // Nombre completo
          nota: notas[index] ? notas[index][0] : "N/A", // Nota o "N/A" si está vacía
      }));

      res.status(200).json({ curso, materia, trimestre, data: resultado });
  } catch (error) {
      console.error("❌ Error al obtener notas:", error);
      res.status(500).json({ error: "Error obteniendo notas" });
  }
});
// API para obtener notas de un alumno específico por su CI
app.get("/api/obtener-notas-alumno", async (req, res) => {
  const { ci } = req.query;  // Obtenemos el CI del query string
  
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });
   // Obtener los metadatos del documento de Google Sheets
    const res = await sheets.spreadsheets.get({
    spreadsheetId,
    })

    if (!ci) { 
      return res.status(400).json({ error: "Faltan parámetros (CI)" });
    }

    // Buscar en todas las hojas el CI del alumno para determinar a qué curso pertenece
    //const cursos = ["PRIMEROA", "PRIMEROB", "SEGUNDOA", "SEGUNDOB", "TERCEROA", "TERCEROB", "CUARTOA", "CUARTOB", "QUINTOA", "QUINTOB", "SEXTOA", "SEXTOB", "SEXTOC", "SEXTOE"];
    const cursos = res.data.sheets.map(sheet => sheet.properties.title);
    let curso = null;

    // Buscar el CI en todas las hojas
    for (const grado of cursos) {
      const alumnosResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${grado}!C2:C`, // Columna A: CI del alumno
      });

      const alumnos = alumnosResponse.data.values || [];

      // Comprobar si el CI existe en esta hoja
      if (alumnos.some((alumno) => alumno[0] === ci)) {
        curso = grado;
        break;
      }
    }

    if (!curso) {
      return res.status(400).json({ error: "No se encontró al alumno con ese CI." });
    }

    // Obtener encabezados de la hoja (Fila 1)
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${curso}!A1:1`, // Primera fila con títulos
    });

    const headers = headerResponse.data.values[0];

    // Obtener todas las materias y notas del alumno
    const materiasNotas = [];

    // Iteramos por las columnas (de materias)
    for (let i = 1; i < headers.length; i++) {
      const columnaMateria = headers[i];

      // Obtenemos las notas de esta materia
      const notasResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${curso}!${getExcelColumnLetter(i)}2:${getExcelColumnLetter(i)}`, // Notas desde la fila 2
      });

      const notas = notasResponse.data.values || [];
      const nota = notas.find(nota => nota[0] !== undefined); // Obtenemos la nota del alumno

      if (nota) {
        // Añadimos la materia con su respectiva nota
        materiasNotas.push({
          materia: columnaMateria,
          nota: nota[0],
        });
      }
    }

    res.status(200).json({ curso, data: materiasNotas });
  } catch (error) {
    console.error("❌ Error al obtener notas:", error);
    res.status(500).json({ error: "Error obteniendo notas" });
  }
});



// Iniciar el servidor
app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});
