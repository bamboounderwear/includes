const fs = require('fs');
const path = require('path');

// Function to process <include> tags in the HTML content
function processIncludes(html, baseDir) {
  return html.replace(/<include\s+src="([^"]+)"\s*\/?>/g, (match, src) => {
    const filePath = path.join(baseDir, src);
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      console.warn(`Warning: Could not read ${filePath}`);
      return "";
    }
  });
}

// Define paths for the input (src) and output (dist) files
const inputPath = path.join(__dirname, 'src', 'index.html');
const outputDir = path.join(__dirname, 'dist');
const outputPath = path.join(outputDir, 'index.html');

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Read the source HTML file, process includes, and write the result
const htmlContent = fs.readFileSync(inputPath, 'utf8');
const processedHtml = processIncludes(htmlContent, path.join(__dirname, 'src'));
fs.writeFileSync(outputPath, processedHtml, 'utf8');

console.log(`Build completed. Output file: ${outputPath}`);
