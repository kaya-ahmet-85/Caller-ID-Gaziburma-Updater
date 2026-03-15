using System;
using System.Reflection;
using System.Windows.Forms;

public class Introspector {
    public static void Main() {
        try {
            Assembly axAssembly = Assembly.LoadFrom("AxInterop.GCallerID1C.dll");
            Type componentType = axAssembly.GetType("AxGCallerID1C.AxGCallerID_Component");
            
            if (componentType == null) {
                Console.WriteLine("Component type not found.");
                return;
            }

            Console.WriteLine("Events of AxGCallerID_Component:");
            foreach (EventInfo ev in componentType.GetEvents()) {
                Console.WriteLine(ev.Name + " -> " + ev.EventHandlerType.Name);
            }
        } catch (Exception ex) {
            Console.WriteLine("Error: " + ex.Message);
        }
    }
}
