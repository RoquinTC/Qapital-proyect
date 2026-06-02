package app.quid.finance;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.Executor;

@CapacitorPlugin(name = "QuidBiometric")
public class QuidBiometricPlugin extends Plugin {
    private static final int ALLOWED_AUTHENTICATORS =
        BiometricManager.Authenticators.BIOMETRIC_STRONG |
        BiometricManager.Authenticators.BIOMETRIC_WEAK;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        int status = BiometricManager.from(getContext()).canAuthenticate(ALLOWED_AUTHENTICATORS);
        JSObject result = new JSObject();
        result.put("available", status == BiometricManager.BIOMETRIC_SUCCESS);
        result.put("status", status);
        call.resolve(result);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        int status = BiometricManager.from(getContext()).canAuthenticate(ALLOWED_AUTHENTICATORS);
        if (status != BiometricManager.BIOMETRIC_SUCCESS) {
            call.reject("La biometría no está disponible en este dispositivo", String.valueOf(status));
            return;
        }

        Executor executor = ContextCompat.getMainExecutor(getContext());
        getActivity().runOnUiThread(() -> {
            BiometricPrompt prompt = new BiometricPrompt(
                getActivity(),
                executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        JSObject response = new JSObject();
                        response.put("authenticated", true);
                        call.resolve(response);
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        call.reject(errString.toString(), String.valueOf(errorCode));
                    }
                }
            );

            BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Desbloquear Quid")
                .setSubtitle("Confirma tu identidad para continuar")
                .setNegativeButtonText("Usar PIN")
                .setAllowedAuthenticators(ALLOWED_AUTHENTICATORS)
                .build();

            prompt.authenticate(promptInfo);
        });
    }
}
