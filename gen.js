const fs = require('fs');
const path = require('path');

const notesDir = path.join(__dirname, 'notes');
const papersDir = path.join(__dirname, 'papers');

function generateLinks(dir, type) {
  if (!fs.existsSync(dir)) return '';
  const files = fs.readdirSync(dir);
  let html = `<h3>${type}</h3>\n<ul>\n`;
  files.forEach(file => {
    const filePath = `${type.toLowerCase()}/${file}`; // relative path
    html += `  <li><a href="${filePath}" target="_blank">${file}</a></li>\n`;
  });
  html += '</ul>\n';
  return html;
}

const notesLinks = generateLinks(notesDir, 'Notes');
const papersLinks = generateLinks(papersDir, 'Papers');

const htmlContent = `
<!-- GENERATED FILE LINKS -->
<section>
${notesLinks}
${papersLinks}
</section>
`;

// Save to a file (e.g., resources.html)
fs.writeFileSync('math-resources.html', htmlContent);
console.log('HTML links generated successfully in math-resources.html');