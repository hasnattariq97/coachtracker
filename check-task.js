const db = require('./server/db');

console.log('\n=== CHECKING TASK WITH LINKS ===\n');

const task = db.prepare('SELECT id, title, description, links FROM tasks WHERE id = 535').get();

console.log('Task ID:', task.id);
console.log('Title:', task.title);
console.log('Description:', task.description);
console.log('Links (raw):', task.links);

if (task.links) {
  try {
    const links = JSON.parse(task.links);
    console.log('\nLinks (parsed):');
    console.log(JSON.stringify(links, null, 2));
  } catch (e) {
    console.log('Error parsing links:', e.message);
  }
} else {
  console.log('\n⚠️  Links field is NULL - not saved!');
}
