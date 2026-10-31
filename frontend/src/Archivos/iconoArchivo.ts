export function iconoArchivo(nombre: string) {
  const extension = nombre.split(".").pop()?.toLowerCase();

  if (
    ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(
      extension ?? ""
    )
  ) {
    return "lucide:image";
  }

  if (["zip", "rar", "7z"].includes(extension ?? "")) {
    return "lucide:archive";
  }

  if (
    ["ts", "tsx", "js", "jsx", "json", "html", "css"].includes(
      extension ?? ""
    )
  ) {
    return "lucide:code";
  }

  if (["pdf", "doc", "docx", "txt"].includes(extension ?? "")) {
    return "lucide:file-text";
  }

  return "lucide:file";
}
