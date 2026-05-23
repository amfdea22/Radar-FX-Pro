$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ProjectDir = "C:\Users\Deah\Desktop\Radar-FX"
$BatPath = "$ProjectDir\INICIAR_RADAR_FX.bat"
$LogoPath = "$ProjectDir\client\public\radar_fx_icon.ico"

# Nome do atalho conforme solicitado pelo usuário
$ShortcutName = "Radar Fx.lnk"

# Limpar atalhos antigos com nomes parecidos para evitar duplicidade
Get-Item -Path "$DesktopPath\Radar*.lnk", "$DesktopPath\Radar*.url" -ErrorAction SilentlyContinue | Remove-Item -Force

# Criar o atalho no Desktop
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut("$DesktopPath\$ShortcutName")
$Shortcut.TargetPath = "cmd.exe"
$Shortcut.Arguments = "/c `"$BatPath`""
$Shortcut.WorkingDirectory = $ProjectDir
$Shortcut.Description = "Iniciar Radar-FX App"
$Shortcut.IconLocation = "$LogoPath,0"
$Shortcut.Save()

Write-Host "Atalho '$ShortcutName' atualizado com sucesso na Área de Trabalho com suporte a ícone (.ico)!"
