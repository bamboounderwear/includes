const fs = require('fs');
const path = require('path');

// Define base paths
const srcDir = path.join(__dirname, 'src');
const pagesDir = path.join(srcDir, 'pages');
const componentsDir = path.join(srcDir, 'components');
const outputDir = path.join(__dirname, 'dist');

// Function to process <include> tags in the HTML content
// Looks for components within the componentsDir
function processIncludes(html, baseComponentDir) {
  return html.replace(/<include\s+src="([^"]+)"\s*\/?>/g, (match, src) => {
    const filePath = path.join(baseComponentDir, src);
    try {
      // Read the component file content
      return fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      console.warn(`Warning: Could not read include file ${filePath}. Error: ${err.message}`);
      return ""; // Return empty string if include fails
    }
  });
}

// Ensure the output directory exists, create if it doesn't
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true }); // Use recursive: true for safety
  console.log(`Created output directory: ${outputDir}`);
} else {
    console.log(`Output directory already exists: ${outputDir}`);
}

// Read all files from the pages directory
try {
  const files = fs.readdirSync(pagesDir);

  files.forEach(file => {
    // Process only .html files
    if (path.extname(file) === '.html') {
      const inputFilePath = path.join(pagesDir, file);
      const outputFilePath = path.join(outputDir, file);

      console.log(`Processing ${inputFilePath}...`);

      // Read the source HTML file
      const htmlContent = fs.readFileSync(inputFilePath, 'utf8');

      // Process includes, passing the components directory path
      const processedHtml = processIncludes(htmlContent, componentsDir);

      // Write the processed HTML to the output directory
      fs.writeFileSync(outputFilePath, processedHtml, 'utf8');

      console.log(` -> Output written to ${outputFilePath}`);
    } else {
        console.log(`Skipping non-html file: ${file}`);
    }
  });

  console.log('\nBuild completed successfully!');

} catch (err) {
  console.error(`Error reading pages directory ${pagesDir}: ${err.message}`);
  process.exit(1); // Exit script with error status
}