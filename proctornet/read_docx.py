import docx

def read_docx(file_path):
    doc = docx.Document(file_path)
    for i, para in enumerate(doc.paragraphs):
        if para.text.strip():
            print(f"Para {i}: {para.text[:100]}")
        if i > 50: # just read first 50 paragraphs to get an idea
            print("... (truncated)")
            break

if __name__ == '__main__':
    read_docx("B04_Final_Year_Project_Updated new one.docx")
