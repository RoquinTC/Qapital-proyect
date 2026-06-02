package app.quid.finance;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(QuidBiometricPlugin.class);
        registerPlugin(QuidCalendarPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
