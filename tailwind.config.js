// File: tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      './src/**/*.html', // Scan all HTML files in src
      './src/**/*.js',   // Include JS if you add classes dynamically
    ],
    theme: {
      extend: {},
    },
    plugins: [],
  }