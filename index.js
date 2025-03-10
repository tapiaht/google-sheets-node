const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
//const fs = require("fs");
const app = express();
app.use(bodyParser.json());
// Cargar credenciales
const auth = new google.auth.GoogleAuth({
  keyFile: "centralizador-453301-583e19a2cb51.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// ID de la hoja de Google Sheets (tómalo de la URL de tu hoja)
const SPREADSHEET_ID = "15LdTnxKc1bNoWqhsYy9-B5YC2dh05RLlJrzFKQpuZhs";
//const RANGE = "Hoja1!A1:C10"; // Rango de celdas a leer/escribir

  
app.post("/api/update-sheets", async (req, res) => {
    try {
      console.log("JSON recibido:", req.body); // Para ver el JSON en la consola
  
      const client = await auth.getClient();
      const sheets = google.sheets({ version: "v4", auth: client });
  
      const valores = req.body.data;
  
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Sheet1!A1", // 🟢 Usar una celda específica para que Google Sheets lo maneje automáticamente
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: valores },
      });
  
      res.status(200).json({ message: "Datos guardados en Google Sheets" });
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "Error guardando en Google Sheets" });
    }
  });
  
  app.listen(3000, () => console.log("Servidor corriendo en http://localhost:3000"));
