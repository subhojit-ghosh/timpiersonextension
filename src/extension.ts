import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "timpiersonextension.openfiles",
    async () => {
      const jsFiles = await vscode.workspace.findFiles(
        "**/*.js",
        "**/node_modules/**"
      );
      const tsFiles = await vscode.workspace.findFiles(
        "**/*.ts",
        "**/node_modules/**"
      );
      const yamlFiles = await vscode.workspace.findFiles(
        "**/*.yaml",
        "**/node_modules/**"
      );

      const allFiles = [...jsFiles, ...tsFiles, ...yamlFiles];
      for (const file of allFiles) {
        const openPath = vscode.Uri.parse("file://" + file.path);
        const doc = await vscode.workspace.openTextDocument(openPath);
        await vscode.window.showTextDocument(doc, {
          preview: false,
        });
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
