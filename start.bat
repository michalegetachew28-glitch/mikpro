@echo off
echo Starting Garage Management System Backend...
start cmd /k "cd backend && node index.js"
echo Starting Garage Management System Frontend...
echo Open Chrome and go to: http://localhost:5173
echo.
npm run dev

