"""Crea dos documentos sintéticos para el ensayo aislado de LibreOffice."""
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def crear(destino, archivos):
    with ZipFile(destino, "w", ZIP_DEFLATED) as paquete:
        for nombre, contenido in archivos.items():
            paquete.writestr(nombre, contenido)


def main():
    destino = Path(sys.argv[1]).resolve()
    destino.mkdir(parents=True, exist_ok=True)
    tipos = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>{}</Types>'
    relaciones = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="{}"/></Relationships>'
    crear(destino / "prueba.docx", {
        "[Content_Types].xml": tipos.format('<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'),
        "_rels/.rels": relaciones.format("word/document.xml"),
        "word/document.xml": '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Vaultly DOCX prueba</w:t></w:r></w:p><w:sectPr/></w:body></w:document>',
    })
    crear(destino / "prueba.xlsx", {
        "[Content_Types].xml": tipos.format('<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'),
        "_rels/.rels": relaciones.format("xl/workbook.xml"),
        "xl/workbook.xml": '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Prueba" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Vaultly XLSX prueba</t></is></c></row><row r="2"><c r="A2"><v>42</v></c></row></sheetData></worksheet>',
    })
    print("Fixtures DOCX y XLSX creados en", destino)


if __name__ == "__main__":
    main()
