import mammoth from 'mammoth';
import PDFParser from 'pdf2json';

export async function extractTextFromFile(file: File): Promise<string> {
    const fileType = file.type;
    
    if (fileType === 'application/pdf') {
        return await extractTextFromPDF(file);
    } else if (fileType === 'text/plain') {
        return await file.text();
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
    }
    
    throw new Error(`Unsupported file type: ${fileType}`);
}

async function extractTextFromPDF(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            const pdfParser = new (PDFParser as any)(null, 1);
            
            pdfParser.on('pdfParser_dataError', (errData: any) => {
                reject(new Error(`PDF parsing failed: ${errData.parserError}`));
            });
            
            pdfParser.on('pdfParser_dataReady', () => {
                try {
                    const parsedText = pdfParser.getRawTextContent();
                    
                    if (!parsedText || parsedText.trim().length === 0) {
                        reject(new Error('No text could be extracted from PDF'));
                        return;
                    }
                    
                    resolve(parsedText);
                } catch (error) {
                    reject(error);
                }
            });
            
            file.arrayBuffer().then(arrayBuffer => {
                const buffer = Buffer.from(arrayBuffer);
                pdfParser.parseBuffer(buffer);
            }).catch(reject);
            
        } catch (error) {
            reject(error);
        }
    });
}

export function extractMetadata(file: File): Record<string, any> {
    return {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        uploadDate: new Date().toISOString(),
    };
}