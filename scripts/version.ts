import fs from 'fs';
import path from 'path';

console.log('ℹ️ Running custom script to pin versions to each other');

const packages = fs
  .readdirSync(path.join(__dirname, '..', 'packages'), { withFileTypes: true })
  .filter((file) => file.isDirectory())
  .map((dir) => dir.name)
  .filter((dir) => !dir.startsWith('.'));

for (const name of packages) {
  const packageJSON = path.join(
    __dirname,
    '..',
    'packages',
    name,
    'package.json',
  );
  if (!fs.existsSync(packageJSON)) {
    continue;
  }

  const content = fs.readFileSync(packageJSON).toString();

  const version = JSON.parse(content).version;
  // matches `"@edgestore/*: ".*"` and replaces it with `"@edgestore/*: "${version}""`
  const newContent = content.replace(
    /\"@edgestore\/((\w|-)+)\": "([^"]|\\")*"/g,
    `"@edgestore/$1": "${version}"`,
  );
  fs.writeFileSync(packageJSON, newContent);
  console.log(`  📍 Pinned ${name} @edgestore/* dependencies`);
}
