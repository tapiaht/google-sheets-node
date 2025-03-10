const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const app = express();
require("dotenv").config();
app.use(bodyParser.json());

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
  const curso = req.query.curso;  // El curso se recibe en la consulta (query)

  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    // Rango de la hoja de Google Sheets donde están los alumnos
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!B:B",  // Cambia esto según el formato de tu hoja
    });

    const rows = response.data.values;
    if (rows.length) {
      // Filtrar los alumnos por el curso (en la columna C, por ejemplo)
      const alumnos = rows.filter(row => row[2] === curso); // Aquí asumimos que la columna 2 es "curso"
      res.json({ data: alumnos });
    } else {
      res.status(404).json({ message: "No se encontraron alumnos para este curso" });
    }
  } catch (error) {
    console.error("Error al obtener los alumnos:", error);
    res.status(500).json({ error: "Error al obtener los alumnos" });
  }
});

// Ruta para cargar las notas a Google Sheets
app.post("/api/cargar-notas", async (req, res) => {
    const data = req.body.data;  // Los datos de las calificaciones que recibimos desde Excel
    const curso = req.body.curso;  // El curso que se está trabajando
    //console.log(data)
    try {
      const client = await auth.getClient();
      const sheets = google.sheets({ version: "v4", auth: client });
  
      // Verifica si data está presente y tiene contenido
      if (!data || data.length === 0) {
        return res.status(400).json({ error: "No se han recibido datos válidos" });
      }
  
      // 1. Leer todos los estudiantes del curso desde Google Sheets
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Sheet1!A2:E",  // Leer desde la fila 2 (para no sobrescribir encabezados)
      });
  
      const alumnos = response.data.values;
      if (!alumnos) {
        return res.status(400).json({ error: "No se encontraron datos en la hoja de Google Sheets" });
      }
  
      // 2. Filtrar solo los estudiantes del curso seleccionado
      const alumnosDelCurso = alumnos.filter(alumno => alumno[2] === curso);
      //const alumnosDelCurso = alumnos.filter(alumno => console.log(alumno[2]));
      
      // 3. Preparar los datos para la actualización
      const actualizarNotas = [];
  
      // 4. Comparar los estudiantes y preparar las actualizaciones
      for (const alumno of alumnosDelCurso) {
        // Buscar el estudiante en los datos recibidos desde Excel
        //console.log(alumno[0])
        const alumnoEnExcel = data.find(row => row[0] === alumno[0]);
        //console.log(alumnoEnExcel)
        
        if (alumnoEnExcel) {
          // Si existe, actualizar las calificaciones
          const index = alumnos.indexOf(alumno);  // Obtener el índice del alumno en el array
            //console.log(alumnoEnExcel)
          // Preparar los datos para la actualización en la hoja
          actualizarNotas.push({
            range: `Sheet1!D${index + 2}:G${index + 2}`, // Actualiza las columnas de las calificaciones
            values: [[
              alumnoEnExcel[2] || '',
              alumnoEnExcel[3] || '',
              alumnoEnExcel[4] || '',
              alumnoEnExcel[5] || ''
            ]],
          });
        }
      }
  
      // 5. Realizar la actualización de las calificaciones en Google Sheets
      for (const actualizacion of actualizarNotas) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: actualizacion.range,
          valueInputOption: "RAW",
          requestBody: {
            values: actualizacion.values,
          },
        });
      }
  
      res.status(200).json({ message: "Notas actualizadas correctamente en Google Sheets" });
    } catch (error) {
      console.error("Error al cargar las notas:", error);
      res.status(500).json({ error: "Error cargando las notas" });
    }
  });
  
// Ruta para obtener todas las notas desde Google Sheets
app.get("/api/obtener-notas", async (req, res) => {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A:F",  // Cambia esto según el formato de tu hoja
    });

    const rows = response.data.values;
    if (rows.length) {
      res.json({ data: rows });
    } else {
      res.status(404).json({ message: "No se encontraron notas" });
    }
  } catch (error) {
    console.error("Error al obtener las notas:", error);
    res.status(500).json({ error: "Error al obtener las notas" });
  }
});

// Iniciar el servidor
app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});
