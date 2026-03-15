' Gaziburma Caller ID - Sessiz Başlatma (CMD penceresi gizli)
' Bu dosyadan çalıştırınca arka planda CMD penceresi görünmez.
Dim shell, proje
Set shell = CreateObject("WScript.Shell")
proje = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
shell.Run "cmd /c cd /d """ & proje & """ && npm run dev:electron", 0, False
Set shell = Nothing
