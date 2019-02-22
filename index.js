var PDFDocument = require('pdfkit');
var fs = require("fs");
const util = require('./util.js');
const fileSystem = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
var cors = require('cors');
const expr = require('expression-eval');



const port = 3000;


const app = express();
app.use(bodyParser.json());
app.use(cors());
app.get('/',(req,res) => res.send("Hello World!"));

app.post('/pdf1',(req,res) => {

	generateDoc(req.body, res)
	
});

app.get('/pdf',(req,res)=>{
	var filePath = path.join(__dirname, 'output.pdf');
    var stat = fileSystem.statSync(filePath);
    
    res.writeHead(200, {
        'Content-Type': 'application/pdf', 
        'Content-Length': stat.size
    });
    
    var readStream = fileSystem.createReadStream(filePath);
    readStream.on('data', function(data) {
        res.write(data);
    });
    
    readStream.on('end', function() {
        res.end();        
    });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

  

var document = {"type":"doc","content":[{"type":"boring_paragraph","content":[{"type":"text","text":"This paragraph is ,boring, it can't have anything."}]},{"type":"paragraph","content":[{"type":"text","text":"Press ctrl/cmd-space to insert a star, ctrl/cmd-b to toggle shouting, and ctrl/cmd-q to add or remove a link."}]}]};
util.store(document);
function generateDoc(document, response) {
	const doc = new PDFDocument;
	var handleContent = (doc, content) => {
		switch(content.type) {
			case 'text' :
				handleText(doc, content)
				break;
			case 'paragraph': {
				handleParagraph(doc, content)
				break;
			}
			case 'formula': {
				
				
				break;
			}
		}
	}
	const handleFormula = (doc, content) => {
		if(!content.content) {
			return;
		}
		const d = content.content[0].text;
		console.log(document.state)
		const ast = expr.parse(d); // abstract syntax tree (AST)
		const value = expr.eval(ast, document.state); 
		content.content[0].text = value;
		handleText(doc, content.content[0], false);
	}
	var handleText = (doc, content, continued) => {
		if(content.marks && content.marks.length > 0) {
			if(content.marks[0].type === 'shouting') {
				doc.font('fonts/HelveticaNeueLTStd-Md.otf')
				.fontSize(10)
			} else {
				return;
			}
		} else {
			doc.font('fonts/HelveticaNeueLTStd-Lt.otf')
			.fontSize(8.5)
		}
		doc
			.text(content.text, {continued});
		if(!continued) {
			doc.fontSize(8.5)
			.text(' ', {continued: false});
		}
	}

	var handleParagraph =(doc, doct) => {
		if(!doct.content) {
			doc.fontSize(25)
			.text(' ', {continued: false});
			return;
		}
		doct.content.map((content, index) => {
			switch(content.type) {
				case 'text': 
					handleText(doc, content, doct.content.length - 1 > index)
					break;
				
				case 'star': 
					//doc.image('star.png', {width: 15, height: 15, continued: doct.content.length - 1 > index})
					break;
				case "formula":
					handleFormula(doc, content)
					break;
				
			}
		})
	}



	doc.pipe(response);

	document.document.content.map(content => {
		handleContent(doc, content)
	});

	doc.end();
}