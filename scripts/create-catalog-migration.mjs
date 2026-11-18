import { initialCourses } from '../src/catalog.js';
import { writeFile } from 'node:fs/promises';
const q=value=>"'"+String(value).replaceAll("'","''")+"'";
const sql=['-- Initial demonstration catalog; existing records are never overwritten.'];
initialCourses.forEach((course,i)=>{const category='category-'+(i+1);sql.push(`INSERT OR IGNORE INTO course_categories(id,name,position) VALUES (${q(category)},${q(course.category)},${i});`);sql.push(`INSERT OR IGNORE INTO courses(id,category_id,data,published,featured,position,updated_at) VALUES (${q(course.id)},${q(category)},${q(JSON.stringify(course))},${course.published?1:0},1,${i},0);`)});
await writeFile(new URL('../migrations/0003_initial_catalog.sql',import.meta.url),sql.join('\n')+'\n');
