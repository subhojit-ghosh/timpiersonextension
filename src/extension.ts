import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { v4 as uuidv4 } from "uuid";

const writeSerializedBlobToFile = (serializeBlob: any, fileName: any) => {
  const bytes = new Uint8Array(serializeBlob.split(","));
  fs.writeFileSync(fileName, Buffer.from(bytes));
};

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "timpiersonextension.openfiles",
      async () => {
        const files = await vscode.workspace.findFiles(
          "**/*.{js,ts,yaml}",
          "**/node_modules/**"
        );
        for (const file of files) {
          try {
            const openPath = vscode.Uri.parse("file://" + file.path);
            const doc = await vscode.workspace.openTextDocument(openPath);
            await vscode.window.showTextDocument(doc, {
              preview: false,
            });
          } catch (error) {}
        }
      }
    )
  );

  const htmlPath = path.resolve(context.extensionPath, "webview/index.html");
  let panel: any;
  let shootFiles: vscode.Uri[] = [];

  vscode.window.registerWebviewPanelSerializer("printallfiles", {
    async deserializeWebviewPanel(_panel, state: any) {
      panel = _panel;
      panel.webview.html = getHtmlContent(htmlPath);
      panel.webview.postMessage({
        type: "restore",
        innerHTML: state.innerHTML,
        bgColor: context.globalState.get("printallfiles.bgColor", "#2e3440"),
      });
      const selectionListener = setupSelectionSync();
      panel.onDidDispose(() => {
        selectionListener.dispose();
      });
      setupMessageListeners();
    },
  });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "timpiersonextension.printallfiles",
      async () => {
        panel = vscode.window.createWebviewPanel(
          uuidv4(),
          "Shooting...",
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            localResourceRoots: [
              vscode.Uri.file(path.join(context.extensionPath, "webview")),
            ],
          }
        );

        panel.webview.html = getHtmlContent(htmlPath);

        const selectionListener = setupSelectionSync();
        panel.onDidDispose(() => {
          selectionListener.dispose();
        });

        setupMessageListeners();

        const fontFamily =
          vscode.workspace.getConfiguration("editor").fontFamily;
        const bgColor = context.globalState.get(
          "printallfiles.bgColor",
          "#2e3440"
        );
        panel.webview.postMessage({
          type: "init",
          fontFamily,
          bgColor,
        });

        syncSettings();

        fs.rmSync(
          path.join(
            // @ts-ignore
            vscode.workspace.workspaceFolders[0].uri.fsPath,
            "output-code-images"
          ),
          {
            recursive: true,
            force: true,
          }
        );
        fs.mkdirSync(
          path.join(
            // @ts-ignore
            vscode.workspace.workspaceFolders[0].uri.fsPath,
            "output-code-images"
          )
        );

        shootFiles = await vscode.workspace.findFiles(
          "**/*.{js,ts,yaml}",
          "**/node_modules/**"
        );
        if (shootFiles.length) {
          await shoot(shootFiles[0]);
          shootFiles.splice(0, 1);
        }
      }
    )
  );

  vscode.workspace.onDidChangeConfiguration((e) => {
    if (
      e.affectsConfiguration("printallfiles") ||
      e.affectsConfiguration("editor")
    ) {
      syncSettings();
    }
  });

  async function shoot(file: vscode.Uri) {
    try {
      const openPath = vscode.Uri.parse("file://" + file.path);
      const doc = await vscode.workspace.openTextDocument(openPath);
      await vscode.window.showTextDocument(doc, {
        preview: false,
      });
      await vscode.commands.executeCommand("editor.action.selectAll");
      await vscode.commands.executeCommand(
        "editor.action.clipboardCopyWithSyntaxHighlightingAction"
      );
      panel.webview.postMessage({
        type: "update",
      });
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
      panel.webview.postMessage({
        type: "shootall",
        data: {
          name: file.path.split("/").reverse()[0],
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  async function setupMessageListeners() {
    panel.webview.onDidReceiveMessage(async ({ type, data }: any) => {
      switch (type) {
        case "shoot":
          const filePath = path.join(
            // @ts-ignore
            vscode.workspace.workspaceFolders[0].uri.fsPath,
            "output-code-images",
            data.name + ".png"
          );
          writeSerializedBlobToFile(data.serializedBlob, filePath);
          if (shootFiles.length) {
            await shoot(shootFiles[0]);
            shootFiles.splice(0, 1);
          } else {
            await vscode.commands.executeCommand(
              "workbench.action.closeActiveEditor"
            );
            vscode.window.showInformationMessage("Done");
          }
          break;
        case "getAndUpdateCacheAndSettings":
          panel.webview.postMessage({
            type: "restoreBgColor",
            bgColor: context.globalState.get(
              "printallfiles.bgColor",
              "#2e3440"
            ),
          });

          syncSettings();
          break;
        case "updateBgColor":
          context.globalState.update("printallfiles.bgColor", data.bgColor);
          break;
        case "invalidPasteContent":
          vscode.window.showInformationMessage(
            "Pasted content is invalid. Only copy from VS Code and check if your shortcuts for copy/paste have conflicts."
          );
          break;
      }
    });
  }

  function syncSettings() {
    const settings = vscode.workspace.getConfiguration("printallfiles");
    const editorSettings = vscode.workspace.getConfiguration("editor", null);
    panel.webview.postMessage({
      type: "updateSettings",
      shadow: settings.get("shadow"),
      transparentBackground: settings.get("transparentBackground"),
      backgroundColor: settings.get("backgroundColor"),
      target: settings.get("target"),
      ligature: editorSettings.get("fontLigatures"),
    });
  }

  function setupSelectionSync() {
    return vscode.window.onDidChangeTextEditorSelection((e) => {
      if (e.selections[0] && !e.selections[0].isEmpty) {
        vscode.commands.executeCommand(
          "editor.action.clipboardCopyWithSyntaxHighlightingAction"
        );
        panel.webview.postMessage({
          type: "update",
        });
      }
    });
  }
}

function getHtmlContent(htmlPath: any) {
  const htmlContent = fs.readFileSync(htmlPath, "utf-8");
  return htmlContent.replace(/script src="([^"]*)"/g, (match, src) => {
    const realSource = "vscode-resource:" + path.resolve(htmlPath, "..", src);
    return `script src="${realSource}"`;
  });
}

export function deactivate() {}
