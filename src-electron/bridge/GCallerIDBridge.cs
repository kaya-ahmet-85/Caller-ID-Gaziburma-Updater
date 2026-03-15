using System;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using AxGCallerID1C;

namespace GCallerIDBridge
{
    class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            
            // Gizli bir form içinde ActiveX kontrolünü çalıştırıyoruz
            // Çünkü ActiveX bileşenleri bir Windows Message Loop (Application.Run) ve bir Container (Form) gerektirir.
            Application.Run(new BridgeForm());
        }
    }

    public class BridgeForm : Form
    {
        private AxGCallerID1C.AxGCallerID_Component axComponent;

        public BridgeForm()
        {
            // Formu tamamen gizliyoruz
            this.ShowInTaskbar = false;
            this.WindowState = FormWindowState.Minimized;
            this.Visible = false;
            this.Opacity = 0;
            this.Load += BridgeForm_Load;

            // ActiveX Bileşenini oluştur
            try {
                this.axComponent = new AxGCallerID1C.AxGCallerID_Component();
                ((System.ComponentModel.ISupportInitialize)(this.axComponent)).BeginInit();
                this.Controls.Add(this.axComponent);
                ((System.ComponentModel.ISupportInitialize)(this.axComponent)).EndInit();

                // Event Bağıntıları
                this.axComponent.OnCallerID += AxComponent_OnCallerID;
                this.axComponent.OnDeviceConnection += AxComponent_OnDeviceConnection;
                this.axComponent.OnDeviceDisconnected += AxComponent_OnDeviceDisconnected;
                this.axComponent.Sinyaller += AxComponent_Sinyaller; // Düzeltildi: 'On' kaldırıldı
                
                Console.WriteLine("{\"status\":\"BRIDGE_READY\"}");
            }
            catch (Exception ex) {
                Console.WriteLine("{\"status\":\"ERROR\", \"message\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}");
                Application.Exit();
            }
        }

        private int[] lastLevels = new int[8];

        private void AxComponent_Sinyaller(object sender, AxGCallerID1C.IGCallerID_ComponentEvents_SinyallerEvent e)
        {
            // Sinyal seviyelerini diziye al
            string[] rawLevels = { e.seviye1, e.seviye2, e.seviye3, e.seviye4, e.seviye5, e.seviye6, e.seviye7, e.seviye8 };
            
            for (int i = 0; i < 8; i++)
            {
                int currentLevel;
                if (int.TryParse(rawLevels[i], out currentLevel))
                {
                    // Değişim 20'den büyükse (Biraz daha toleranslı) bildir
                    if (Math.Abs(currentLevel - lastLevels[i]) > 20)
                    {
                        Console.WriteLine("{{\"event\":\"SIGNAL\", \"line\":\"{0}\", \"level\":{1}}}", i + 1, currentLevel);
                        lastLevels[i] = currentLevel;
                    }
                }
            }
        }

        private void BridgeForm_Load(object sender, EventArgs e)
        {
            this.Hide();
        }

        private void AxComponent_OnDeviceConnection(object sender, AxGCallerID1C.IGCallerID_ComponentEvents_OnDeviceConnectionEvent e)
        {
            Console.WriteLine("{\"status\":\"CONNECTED\", \"serial\":\"" + e.devSerialNo + "\"}");
        }

        private void AxComponent_OnDeviceDisconnected(object sender, AxGCallerID1C.IGCallerID_ComponentEvents_OnDeviceDisconnectedEvent e)
        {
            Console.WriteLine("{\"status\":\"DISCONNECTED\"}");
        }

        private void AxComponent_OnCallerID(object sender, AxGCallerID1C.IGCallerID_ComponentEvents_OnCallerIDEvent e)
        {
            // Yakalanan numarayı JSON olarak standart çıktıya (stdout) basıyoruz
            // Electron bu çıktıyı okuyup React'a iletecek
            var json = string.Format(
                "{{\"event\":\"CALL\", \"line\":\"{0}\", \"phone\":\"{1}\", \"date\":\"{2}\", \"time\":\"{3}\", \"serial\":\"{4}\"}}",
                e.lineNo, e.phoneNo, e.callDate, e.callTime, e.devSerialNo
            );
            Console.WriteLine(json);
        }
    }
}
