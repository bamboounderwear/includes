// File: build.js
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// --- Configuration ---
const config = {
    srcDir: path.join(__dirname, 'src'),
    outputDir: path.join(__dirname, 'dist'),
    pagesDir: path.join(__dirname, 'src', 'pages'),
    componentsDir: path.join(__dirname, 'src', 'components'),
    assetsBaseDir: path.join(__dirname, 'src'),
    assetFolders: ['css', 'js', 'images']
};

// --- Helper Functions ---

function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
      return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}

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

function processIncludes(html, baseComponentDir) {
    const includeRegex = /<include\s+src="([^"]+)"([^>]*)\/?>/g;
    let processedHtml = html;
    let includesFoundInPass;
    let depth = 0;
    const maxDepth = 10;

    do {
        if (depth++ > maxDepth) {
            console.error(`Error: Maximum include depth (${maxDepth}) exceeded. Check for circular includes.`);
            return processedHtml;
        }
        includesFoundInPass = false;
        processedHtml = processedHtml.replace(includeRegex, (match, src, attrsString) => {
            includesFoundInPass = true;
            // Adjust path resolution: Look relative to componentsDir *first*
            let filePath = path.join(baseComponentDir, src);

            // If not found in componentsDir, consider if it's relative to the *current* file being processed
            // NOTE: This adds complexity. For now, keeping includes relative to componentsDir only.
            // Add more sophisticated path logic here if needed in the future.

            try {
                let componentContent = fs.readFileSync(filePath, 'utf8');
                const attributes = parseAttributes(attrsString.trim());
                componentContent = componentContent.replace(/{{\s*(\w+)\s*}}/g, (placeholderMatch, varName) => {
                    return attributes[varName] || '';
                });
                return componentContent;
            } catch (err) {
                console.warn(`Warning: Could not read or process include file ${filePath}. Error: ${err.message}`);
                return `<!-- Include Error: ${src} not found or processed -->`;
            }
        });
    } while (includesFoundInPass);

    return processedHtml;
}

// --- Recursive Page Processing Function ---
function processDirectory(inputDir, outputDir) {
    const entries = fs.readdirSync(inputDir, { withFileTypes: true });

    entries.forEach(entry => {
        const inputPath = path.join(inputDir, entry.name);
        const outputPath = path.join(outputDir, entry.name);

        if (entry.isDirectory()) {
            // Create corresponding directory in dist and recurse
            fs.mkdirSync(outputPath, { recursive: true });
            processDirectory(inputPath, outputPath);
        } else if (entry.isFile()) {
            // Process or copy files
            if (path.extname(entry.name) === '.html') {
                console.log(`Processing ${inputPath}...`);
                try {
                    const htmlContent = fs.readFileSync(inputPath, 'utf8');
                    // Process includes relative to the main components directory
                    const processedHtml = processIncludes(htmlContent, config.componentsDir);
                    ensureDirectoryExistence(outputPath); // Ensure parent dir exists
                    fs.writeFileSync(outputPath, processedHtml, 'utf8');
                    console.log(` -> Output written to ${outputPath}`);
                } catch (err) {
                    console.error(`Error processing file ${inputPath}: ${err.message}`);
                }
            } else {
                // Copy non-HTML files directly
                console.log(`Copying non-HTML file: ${inputPath}...`);
                try {
                    ensureDirectoryExistence(outputPath); // Ensure parent dir exists
                    fs.copyFileSync(inputPath, outputPath);
                    console.log(` -> Copied to ${outputPath}`);
                } catch (copyErr) {
                    console.error(`Error copying file ${inputPath} to ${outputPath}: ${copyErr.message}`);
                }
            }
        }
    });
}


// --- Build Process ---

const startTime = performance.now();
console.log('Starting build process...');

// 1. Clean output directory
console.log(`Cleaning output directory: ${config.outputDir}...`);
if (fs.existsSync(config.outputDir)) {
    fs.rmSync(config.outputDir, { recursive: true, force: true });
    console.log(' -> Output directory cleaned.');
} else {
    console.log(' -> Output directory does not exist, no cleaning needed.');
}

// 2. Recreate output directory
fs.mkdirSync(config.outputDir, { recursive: true });
console.log(`Created output directory: ${config.outputDir}`);

// 3. Copy static asset folders
console.log('Copying static assets...');
config.assetFolders.forEach(folder => {
    const sourcePath = path.join(config.assetsBaseDir, folder);
    const destPath = path.join(config.outputDir, folder);
    if (fs.existsSync(sourcePath)) {
        console.log(` -> Copying ${folder}...`);
        copyDirectoryRecursive(sourcePath, destPath);
    } else {
        console.warn(` -> Asset folder ${folder} not found in ${config.assetsBaseDir}. Skipping.`);
    }
});
console.log(' -> Static assets copied.');

// 4. Process pages recursively
console.log(`Processing pages recursively from ${config.pagesDir}...`);
try {
    // Start the recursive processing from the base pages directory
    processDirectory(config.pagesDir, config.outputDir);

    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\nBuild completed successfully in ${duration} seconds!`);

} catch (err) {
    console.error(`Error during page processing: ${err.message}`);
    process.exit(1);
}