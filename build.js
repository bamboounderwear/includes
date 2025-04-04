// File: build.js
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const postcss = require('postcss');       // ADDED
const tailwindcss = require('tailwindcss'); // ADDED
const autoprefixer = require('autoprefixer'); // ADDED

// --- Configuration ---
const config = {
    srcDir: path.join(__dirname, 'src'),
    outputDir: path.join(__dirname, 'dist'),
    pagesDir: path.join(__dirname, 'src', 'pages'),
    componentsDir: path.join(__dirname, 'src', 'components'),
    assetsBaseDir: path.join(__dirname, 'src'),
    assetFolders: ['js', 'images'], // REMOVED 'css' - we will handle it separately
    tailwindInputCss: path.join(__dirname, 'src', 'css', 'tailwind-input.css'), // ADDED
    tailwindOutputCss: path.join(__dirname, 'dist', 'css', 'style.css'), // ADDED - Final output name
    tailwindConfigFile: path.join(__dirname, 'tailwind.config.js'),       // ADDED
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
            return processedHtml; // Return partially processed HTML on error
        }
        includesFoundInPass = false;
        // Use replaceAll for simpler loop logic if Node version supports it,
        // otherwise keep the loop approach
        processedHtml = processedHtml.replace(includeRegex, (match, src, attrsString) => {
            includesFoundInPass = true;
            let filePath = path.join(baseComponentDir, src);

            try {
                let componentContent = fs.readFileSync(filePath, 'utf8');
                const attributes = parseAttributes(attrsString.trim());

                // Replace variables within the component content *before* returning
                componentContent = componentContent.replace(/{{\s*(\w+)\s*}}/g, (placeholderMatch, varName) => {
                    // Use attribute value if present, otherwise keep placeholder or empty string
                    return attributes[varName] || ''; // Return empty string if variable not provided
                });
                return componentContent;
            } catch (err) {
                console.warn(`Warning: Could not read or process include file ${filePath}. Error: ${err.message}`);
                return `<!-- Include Error: ${src} not found or processed -->`;
            }
        });
    } while (includesFoundInPass);

     // Process top-level variables AFTER includes are done
     processedHtml = processedHtml.replace(/{{\s*(\w+)\s*}}/g, (placeholderMatch, varName) => {
        // For top-level variables, we don't have attributes here.
        // You might need a different mechanism if you want page-level variables
        // outside of includes. For now, just remove unresolved top-level vars.
        console.warn(`Warning: Unresolved top-level variable {{ ${varName} }} found.`);
        return '';
    });

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
            // Process HTML files
            if (path.extname(entry.name) === '.html') {
                console.log(`Processing HTML: ${inputPath}...`);
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
                 // We are now handling CSS separately and copying other assets earlier
                 // This block might only handle non-HTML files directly within 'pages'
                 // If you have other file types in 'pages' you want copied, uncomment below:
                 /*
                 console.log(`Copying non-HTML file from 'pages': ${inputPath}...`);
                 try {
                     ensureDirectoryExistence(outputPath); // Ensure parent dir exists
                     fs.copyFileSync(inputPath, outputPath);
                     console.log(` -> Copied to ${outputPath}`);
                 } catch (copyErr) {
                     console.error(`Error copying file ${inputPath} to ${outputPath}: ${copyErr.message}`);
                 }
                 */
            }
        }
    });
}

// --- NEW: Tailwind CSS Processing Function ---
async function processTailwindCSS() {
    console.log('Processing Tailwind CSS...');
    try {
        const cssContent = fs.readFileSync(config.tailwindInputCss, 'utf8');
        ensureDirectoryExistence(config.tailwindOutputCss); // Ensure dist/css exists

        const result = await postcss([
            tailwindcss(config.tailwindConfigFile), // Pass config file path
            autoprefixer
        ]).process(cssContent, {
            from: config.tailwindInputCss,
            to: config.tailwindOutputCss
        });

        fs.writeFileSync(config.tailwindOutputCss, result.css);
        console.log(` -> Tailwind CSS processed successfully to ${config.tailwindOutputCss}`);

        if (result.warnings) {
            result.warnings().forEach(warn => {
                console.warn(`Tailwind Warning: ${warn.toString()}`);
            });
        }
    } catch (err) {
        console.error(`Error processing Tailwind CSS: ${err.message}`);
        // Optionally re-throw or exit if CSS processing is critical
        throw err; // Rethrow to stop the build on CSS error
    }
}


// --- Build Process (Modified to be Async) ---
async function runBuild() { // WRAPPED IN ASYNC FUNCTION
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

    // --- MODIFIED STEPS ---
    try {
        // 3. Process Tailwind CSS FIRST (as it's an asset needed by pages)
        await processTailwindCSS(); // Await the async function

        // 4. Copy *other* static asset folders (JS, images, etc.)
        console.log('Copying other static assets...');
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
        console.log(' -> Other static assets copied.');


        // 5. Process pages recursively
        console.log(`Processing pages recursively from ${config.pagesDir}...`);
        // Start the recursive processing from the base pages directory
        processDirectory(config.pagesDir, config.outputDir);


        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`\nBuild completed successfully in ${duration} seconds!`);

    } catch (err) {
        console.error(`\nBuild failed: ${err.message}`);
        // Log stack trace for CSS errors or other build failures
        if(err.stack) {
            console.error(err.stack);
        }
        process.exit(1); // Exit with error code
    }
    // --- END MODIFIED STEPS ---
}

// --- Execute the build ---
runBuild(); // Call the async function