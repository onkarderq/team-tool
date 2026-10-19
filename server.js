const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = {'/':'index.html','/app.js':'app.js','/styles.css':'styles.css'};
http.createServer((req,res)=>{
 const file=files[req.url.split('?')[0]];
 if(!file){res.writeHead(404);return res.end('Not found');}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
 fs.createReadStream(path.join(__dirname,file)).pipe(res);
}).listen(process.env.PORT || 3000,'0.0.0.0',()=>console.log('Teamspace running on port '+(process.env.PORT || 3000)));
