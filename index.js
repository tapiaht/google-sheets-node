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
      range: `${grado}!A:D`,  // Asume que cada curso tiene su propia hoja
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
app.post("/api/cargar-notas", async (req, res) => {
  const data = req.body.data;  // Datos de las calificaciones desde Excel
  const curso = req.body.curso;  // Curso seleccionado
  
  try {
      const client = await auth.getClient();
      const sheets = google.sheets({ version: "v4", auth: client });
      
      // Verificar si hay datos
      if (!data || data.length === 0) {
          return res.status(400).json({ error: "No se han recibido datos válidos" });
      }
      
      // Determinar la hoja correspondiente al curso (Ejemplo: PRIMEROA, SEGUNDOB, etc.)
      let grado = curso
      grado = grado.replace(' ', '');
      // Leer datos de la hoja específica
      console.log(grado)
      const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${grado}!A2:G`,  // Leer desde la fila 2
      });
      
      const alumnos = response.data.values;
      if (!alumnos) {
          return res.status(400).json({ error: "No se encontraron datos en la hoja de Google Sheets" });
      }
      
      const actualizarNotas = [];
      
      // Comparar estudiantes y preparar las actualizaciones
      for (const alumno of alumnos) {
          const alumnoEnExcel = data.find(row => row[0] === alumno[0]);
          
          if (alumnoEnExcel) {
              const index = alumnos.indexOf(alumno);  // Índice del alumno en la hoja
              
              actualizarNotas.push({
                  range: `${grado}!E${index + 2}:H${index + 2}`, // Actualiza notas en columnas E-H
                  values: [[
                      alumnoEnExcel[2] || '',
                      alumnoEnExcel[3] || '',
                      alumnoEnExcel[4] || '',
                      alumnoEnExcel[5] || ''
                  ]],
              });
          }
      }
      
      // Realizar la actualización en un solo batchUpdate
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
      console.error("Error al cargar las notas:", error);
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
      range: `${grado}!A:F`,  // Ajustado para que tome el curso correcto
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: `No se encontraron notas para el curso ${grado}` });
    }

    res.json({ data: rows });
  } catch (error) {
    console.error("Error al obtener las notas:", error);
    res.status(500).json({ error: "Error al obtener las notas" });
  }
});

// Iniciar el servidor
app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});
