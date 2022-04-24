import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "timpiersonextension.openfiles",
    async () => {
      const allFiles = await vscode.workspace.findFiles(
        "**/*.{js,ts,yaml}",
        "**/node_modules/**"
      );
      for (const file of allFiles) {
        try {
          const openPath = vscode.Uri.parse("file://" + file.path);
          const doc = await vscode.workspace.openTextDocument(openPath);
          await vscode.window.showTextDocument(doc, {
            preview: false,
          });
        } catch (error) {}
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
