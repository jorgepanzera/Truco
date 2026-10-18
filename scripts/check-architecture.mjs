import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

export function checkManifest(name, manifest) {
  const errors = [];
  for (const field of dependencyFields) {
    for (const dependency of Object.keys(manifest[field] ?? {})) {
      if (!(name === "game-engine" && field === "dependencies" && dependency === "@truco/shared")) {
        errors.push(`${name}: dependencia prohibida ${dependency} en ${field}`);
      }
    }
  }
  return errors;
}

export function checkSource(name, filename, text, isLocal) {
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
  const errors = [];
  const reject = (message) => errors.push(`${filename}: ${message}`);
  if (
    source.referencedFiles.length ||
    source.typeReferenceDirectives.length ||
    source.libReferenceDirectives.length
  ) {
    reject("las referencias triple slash no están permitidas");
  }
  const checkSpecifier = (specifier) => {
    if (!specifier || !ts.isStringLiteral(specifier)) {
      reject("dependencia dinámica o no literal no permitida");
      return;
    }
    const value = specifier.text;
    if (name === "game-engine" && value === "@truco/shared") return;
    if ((value.startsWith("./") || value.startsWith("../")) && isLocal(value)) return;
    reject(`dependencia prohibida o fuera del paquete: ${value}`);
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) checkSpecifier(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      checkSpecifier(node.moduleReference.expression);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      checkSpecifier(node.argument.literal);
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) checkSpecifier(node.arguments[0]);
      if (ts.isIdentifier(node.expression) && node.expression.text === "require")
        reject("require no está permitido");
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "require"
      )
        reject("require no está permitido");
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return errors;
}

function filesIn(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Enlace simbólico no permitido en fuentes: ${file}`);
    if (entry.isDirectory()) return filesIn(file);
    if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) return [file];
    return [];
  });
}

function checkPackage(name) {
  const dir = path.join(root, "packages", name);
  const src = fs.realpathSync(path.join(dir, "src"));
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  const config = JSON.parse(fs.readFileSync(path.join(dir, "tsconfig.json"), "utf8"));
  const errors = checkManifest(name, manifest);
  const references = (config.references ?? []).map((reference) => reference.path);
  const expected = name === "game-engine" ? ["../shared"] : [];
  if (JSON.stringify(references) !== JSON.stringify(expected))
    errors.push(`${name}: referencias TypeScript inesperadas`);
  for (const filename of filesIn(src)) {
    const local = (specifier) => {
      const resolved = ts.resolveModuleName(
        specifier,
        filename,
        { moduleResolution: ts.ModuleResolutionKind.NodeNext, module: ts.ModuleKind.NodeNext },
        ts.sys,
      ).resolvedModule;
      if (!resolved) return false;
      const target = fs.realpathSync(resolved.resolvedFileName);
      const relative = path.relative(src, target);
      return (
        relative !== "" &&
        !relative.startsWith(`..${path.sep}`) &&
        relative !== ".." &&
        !path.isAbsolute(relative)
      );
    };
    errors.push(...checkSource(name, filename, fs.readFileSync(filename, "utf8"), local));
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const errors = [...checkPackage("game-engine"), ...checkPackage("shared")];
    if (errors.length) {
      console.error(errors.join("\n"));
      process.exitCode = 1;
    } else {
      console.log("Aislamiento de game-engine y shared: correcto");
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
