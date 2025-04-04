// File: build.js
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks'); // Added for timing

// --- Configuration ---
const config = {
    srcDir: path.join(__dirname, 'src'),
    outputDir: path.join(__dirname, 'dist'),
    pagesDir: path.join(__dirname, 'src', 'pages'),
    componentsDir: path.join(__dirname, 'src', 'components'),
    assetsBaseDir: path.join(__dirname, 'src'), // Base directory where asset folders reside
    assetFolders: ['css', 'js', 'images'] // Folders to copy directly
};

// --- Helper Functions ---

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
        }
    }
}

function parseAttributes(attrString) {
    const attributes = {};
    const regex = /(\w+)="([^"]+)"/g;
    let match;
    while ((match = regex.exec(attrString)) !== null) {
        attributes[match[1]] = match[2];
    }
    return attributes;
}

// Updated function to support nested includes
function processIncludes(html, baseComponentDir) {
    const includeRegex = /<include\s+src="([^"]+)"([^>]*)\/?>/g;
    let processedHtml = html;
    let includesFoundInPass;
    let depth = 0; // Add depth counter for safety
    const maxDepth = 10; // Set a maximum recursion depth

    // Keep processing includes as long as new ones are found and processed in a pass
    do {
        if (depth++ > maxDepth) {
            console.error(`Error: Maximum include depth (${maxDepth}) exceeded. Check for circular includes.`);
            // Return the HTML as-is to prevent infinite loop errors from halting the build entirely.
            // Or you could choose to return an error string: return `<!-- ERROR: Maximum include depth exceeded -->`;
            return processedHtml;
        }

        includesFoundInPass = false; // Reset flag for this pass
        processedHtml = processedHtml.replace(includeRegex, (match, src, attrsString) => {
            // If we are executing this callback, it means an include tag was found
            includesFoundInPass = true; // Mark that we found and processed an include in this pass
            const filePath = path.join(baseComponentDir, src);
            try {
                let componentContent = fs.readFileSync(filePath, 'utf8');
                const attributes = parseAttributes(attrsString.trim());

                // Replace placeholders like {{ variableName }} within the component content
                componentContent = componentContent.replace(/{{\s*(\w+)\s*}}/g, (placeholderMatch, varName) => {
                    return attributes[varName] || ''; // Use attribute value or empty string
                });

                // Return the processed component content, which might contain more include tags
                return componentContent;

            } catch (err) {
                console.warn(`Warning: Could not read or process include file ${filePath}. Error: ${err.message}`);
                // Return an empty string or an error comment instead of the tag
                return `<!-- Include Error: ${src} not found or processed -->`;
            }
        });
        // Loop continues if an include was successfully processed in this pass,
        // as the inserted content might contain further includes.
    } while (includesFoundInPass);

    return processedHtml;
}


// --- Build Process ---

const startTime = performance.now(); // Start timer
console.log('Starting build process...');

// 1. Clean the output directory
console.log(`Cleaning output directory: ${config.outputDir}...`);
if (fs.existsSync(config.outputDir)) {
    fs.rmSync(config.outputDir, { recursive: true, force: true });
    console.log(' -> Output directory cleaned.');
} else {
    console.log(' -> Output directory does not exist, no cleaning needed.');
}

// 2. Recreate the output directory
fs.mkdirSync(config.outputDir, { recursive: true });
console.log(`Created output directory: ${config.outputDir}`);

// 3. Copy static asset folders
console.log('Copying static assets...');
config.assetFolders.forEach(folder => {
    const sourcePath = path.join(config.assetsBaseDir, folder);
    const destPath = path.join(config.outputDir, folder);
    if (fs.existsSync(sourcePath)) { // Check if asset folder exists before copying
        console.log(` -> Copying ${folder}...`);
        copyDirectoryRecursive(sourcePath, destPath);
    } else {
        console.warn(` -> Asset folder ${folder} not found in ${config.assetsBaseDir}. Skipping.`);
    }
});
console.log(' -> Static assets copied.');


// 4. Process files in pages directory
console.log(`Processing pages from ${config.pagesDir}...`);
try {
    const files = fs.readdirSync(config.pagesDir);

    files.forEach(file => {
        const inputFilePath = path.join(config.pagesDir, file);
        const outputFilePath = path.join(config.outputDir, file); // Output directly into dist

        // Check if it's a file before processing
        if (fs.statSync(inputFilePath).isFile()) {
            // Process only .html files
            if (path.extname(file) === '.html') {
                console.log(`Processing ${inputFilePath}...`);
                try {
                    // Read the source HTML file
                    const htmlContent = fs.readFileSync(inputFilePath, 'utf8');

                    // Process includes (now recursively) and variables, passing the components directory path
                    const processedHtml = processIncludes(htmlContent, config.componentsDir);

                    // Write the processed HTML to the output directory
                    fs.writeFileSync(outputFilePath, processedHtml, 'utf8');
                    console.log(` -> Output written to ${outputFilePath}`);

                } catch (writeErr) {
                    console.error(`Error writing file ${outputFilePath}: ${writeErr.message}`);
                }

            } else {
                // Copy non-HTML files directly
                console.log(`Copying non-HTML file: ${file}...`);
                try {
                    fs.copyFileSync(inputFilePath, outputFilePath);
                    console.log(` -> Copied to ${outputFilePath}`);
                } catch (copyErr) {
                    console.error(`Error copying file ${inputFilePath} to ${outputFilePath}: ${copyErr.message}`);
                }
            }
        } else {
             console.log(`Skipping directory: ${file}`); // Skip subdirectories within pages
        }
    });

    const endTime = performance.now(); // End timer
    const duration = ((endTime - startTime) / 1000).toFixed(2); // Calculate duration in seconds

    console.log(`\nBuild completed successfully in ${duration} seconds!`);

} catch (err) {
    console.error(`Error reading pages directory ${config.pagesDir}: ${err.message}`);
    process.exit(1); // Exit script with error status
}