const fs = require('fs');
const path = require('path');

// Define base paths
const srcDir = path.join(__dirname, 'src');
const pagesDir = path.join(srcDir, 'pages');
const componentsDir = path.join(srcDir, 'components');
const assetsDir = srcDir; // Assuming assets (css, js, images) are directly in src subfolders
const outputDir = path.join(__dirname, 'dist');

// --- Helper Functions ---

// Function to recursively copy a directory
function copyDirectoryRecursive(source, destination) {
  if (!fs.existsSync(source)) {
    console.warn(`Warning: Asset source directory ${source} does not exist. Skipping.`);
    return;
  }
  fs.mkdirSync(destination, { recursive: true });
  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      // console.log(` -> Copied asset: ${destPath}`); // Optional: verbose logging
    }
  }
}

// Function to parse attributes from the include tag string
// Example: `title="About Us" class="header"` -> `{ title: 'About Us', class: 'header' }`
function parseAttributes(attrString) {
    const attributes = {};
    const regex = /(\w+)="([^"]+)"/g;
    let match;
    while ((match = regex.exec(attrString)) !== null) {
        attributes[match[1]] = match[2];
    }
    return attributes;
}

// Function to process <include> tags and variable placeholders
function processIncludes(html, baseComponentDir) {
    // Regex to find <include src="..." ... /> tags
    // It captures the src attribute and any other attributes
    const includeRegex = /<include\s+src="([^"]+)"([^>]*)\/?>/g;

    return html.replace(includeRegex, (match, src, attrsString) => {
        const filePath = path.join(baseComponentDir, src);
        try {
            let componentContent = fs.readFileSync(filePath, 'utf8');
            const attributes = parseAttributes(attrsString.trim());

            // Replace placeholders like {{ variableName }}
            componentContent = componentContent.replace(/{{\s*(\w+)\s*}}/g, (placeholderMatch, varName) => {
                // Return the attribute value if found, otherwise return the placeholder itself (or empty string)
                return attributes[varName] !== undefined ? attributes[varName] : placeholderMatch;
                // Alternative: return '' if var not found: return attributes[varName] || '';
            });

            return componentContent;
        } catch (err) {
            console.warn(`Warning: Could not read or process include file ${filePath}. Error: ${err.message}`);
            return ""; // Return empty string if include fails
        }
    });
}


// --- Build Process ---

// 1. Clean the output directory
console.log(`Cleaning output directory: ${outputDir}...`);
if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
  console.log(' -> Output directory cleaned.');
} else {
    console.log(' -> Output directory does not exist, no cleaning needed.');
}

// 2. Recreate the output directory
fs.mkdirSync(outputDir, { recursive: true });
console.log(`Created output directory: ${outputDir}`);

// 3. Copy static asset folders (css, js, images)
console.log('Copying static assets...');
const assetFolders = ['css', 'js', 'images'];
assetFolders.forEach(folder => {
  const sourcePath = path.join(assetsDir, folder);
  const destPath = path.join(outputDir, folder);
  console.log(` -> Copying ${folder}...`);
  copyDirectoryRecursive(sourcePath, destPath);
});
console.log(' -> Static assets copied.');


console.log('Processing HTML pages...');
try {
  const files = fs.readdirSync(pagesDir);

  files.forEach(file => {
    // Process only .html files
    if (path.extname(file) === '.html') {
      const inputFilePath = path.join(pagesDir, file);
      const outputFilePath = path.join(outputDir, file); // Output directly into dist

      console.log(`Processing ${inputFilePath}...`);

      // Read the source HTML file
      const htmlContent = fs.readFileSync(inputFilePath, 'utf8');

      // Process includes and variables, passing the components directory path
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