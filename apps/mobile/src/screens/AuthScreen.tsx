import * as React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import {
  isClerkAPIResponseError,
  useSignIn,
  useSignUp,
  useSSO,
} from "@clerk/clerk-expo";
import { Screen } from "../components/Screen";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { getBaseUrl } from "../utils/baseUrl";

WebBrowser.maybeCompleteAuthSession();

type EmailMode = "signIn" | "signUp";
type VerificationMode = "signIn" | "signUp" | null;

export function AuthScreen() {
  const { startSSOFlow } = useSSO();
  const { isLoaded, signIn, setActive } = useSignIn();
  const {
    isLoaded: isSignUpLoaded,
    signUp,
    setActive: setSignUpActive,
  } = useSignUp();
  const [error, setError] = React.useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = React.useState<string | null>(
    null,
  );
  const [isBypassing, setIsBypassing] = React.useState(false);
  const [isEmailLoading, setIsEmailLoading] = React.useState(false);
  const [emailMode, setEmailMode] = React.useState<EmailMode>("signIn");
  const [verificationMode, setVerificationMode] =
    React.useState<VerificationMode>(null);
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [verificationCode, setVerificationCode] = React.useState("");

  const baseUrl = React.useMemo(() => getBaseUrl(), []);
  const trimmedFirstName = firstName.trim();
  const trimmedLastName = lastName.trim();
  const trimmedEmailAddress = emailAddress.trim();
  const isBusy = !!loadingProvider || isBypassing || isEmailLoading;
  const canSubmitEmail =
    !!trimmedEmailAddress &&
    !!password &&
    (emailMode === "signIn" || (!!trimmedFirstName && !!trimmedLastName)) &&
    !isBusy &&
    isLoaded &&
    isSignUpLoaded;
  const canVerifyEmail = !!verificationCode.trim() && !isBusy;

  const showDevBypass = React.useMemo(() => {
    if (!__DEV__) {
      return false;
    }

    try {
      const hostname = new URL(baseUrl).hostname;
      return (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1" ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
      );
    } catch {
      return false;
    }
  }, [baseUrl]);

  const startProvider = async (strategy: "oauth_google" | "oauth_apple") => {
    try {
      setError(null);
      setLoadingProvider(strategy);
      const { createdSessionId, setActive } = await startSSOFlow({ strategy });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoadingProvider(null);
    }
  };

  const signInWithDevBypass = async () => {
    try {
      setError(null);
      setIsBypassing(true);

      const response = await fetch(`${baseUrl}/api/dev/auth-bypass`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        ticket?: string;
        error?: string;
      };
      if (!response.ok || !payload.ticket) {
        throw new Error(payload.error ?? "Failed to start dev bypass sign-in");
      }

      if (!isLoaded || !signIn || !setActive) {
        throw new Error("Clerk is not ready yet");
      }

      const attempt = await signIn.create({
        strategy: "ticket",
        ticket: payload.ticket,
      });
      if (!attempt.createdSessionId) {
        throw new Error("Dev bypass sign-in did not create a session");
      }

      await setActive({ session: attempt.createdSessionId });
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setIsBypassing(false);
    }
  };

  const startEmailAuth = async () => {
    if (!canSubmitEmail) return;

    try {
      setError(null);
      setIsEmailLoading(true);

      if (emailMode === "signUp") {
        await signUp.create({
          emailAddress: trimmedEmailAddress,
          password,
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
        });
        await signUp.prepareEmailAddressVerification({
          strategy: "email_code",
        });
        setVerificationMode("signUp");
        return;
      }

      const signInAttempt = await signIn.create({
        strategy: "password",
        identifier: trimmedEmailAddress,
        password,
      });

      if (
        signInAttempt.status === "complete" &&
        signInAttempt.createdSessionId
      ) {
        await setActive({ session: signInAttempt.createdSessionId });
        return;
      }

      if (signInAttempt.status === "needs_second_factor") {
        const emailCodeFactor = signInAttempt.supportedSecondFactors?.find(
          (factor) => factor.strategy === "email_code",
        );

        if (!emailCodeFactor) {
          throw new Error(
            "Your account requires an additional verification method that this app does not support yet.",
          );
        }

        await signIn.prepareSecondFactor({
          strategy: "email_code",
          emailAddressId: emailCodeFactor.emailAddressId,
        });
        setVerificationMode("signIn");
        return;
      }

      throw new Error(
        "Email sign-in could not be completed. Please try again.",
      );
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setIsEmailLoading(false);
    }
  };

  const verifyEmail = async () => {
    const code = verificationCode.trim();
    if (
      !verificationMode ||
      !code ||
      isBusy ||
      !signIn ||
      !signUp ||
      !setActive ||
      !setSignUpActive
    ) {
      return;
    }

    try {
      setError(null);
      setIsEmailLoading(true);

      if (verificationMode === "signUp") {
        const signUpAttempt = await signUp.attemptEmailAddressVerification({
          code,
        });

        if (
          signUpAttempt.status !== "complete" ||
          !signUpAttempt.createdSessionId
        ) {
          throw new Error(
            "Sign-up is missing required account details. Please start again.",
          );
        }

        await setSignUpActive({ session: signUpAttempt.createdSessionId });
        return;
      }

      const signInAttempt = await signIn.attemptSecondFactor({
        strategy: "email_code",
        code,
      });

      if (
        signInAttempt.status !== "complete" ||
        !signInAttempt.createdSessionId
      ) {
        throw new Error(
          "Email verification could not be completed. Please try again.",
        );
      }

      await setActive({ session: signInAttempt.createdSessionId });
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setIsEmailLoading(false);
    }
  };

  const resendVerificationCode = async () => {
    if (!verificationMode || isBusy || !signIn || !signUp) return;

    try {
      setError(null);
      setIsEmailLoading(true);

      if (verificationMode === "signUp") {
        await signUp.prepareEmailAddressVerification({
          strategy: "email_code",
        });
        return;
      }

      const emailCodeFactor = signIn.supportedSecondFactors?.find(
        (factor) => factor.strategy === "email_code",
      );
      if (!emailCodeFactor) {
        throw new Error(
          "Email verification is not available for this account.",
        );
      }

      await signIn.prepareSecondFactor({
        strategy: "email_code",
        emailAddressId: emailCodeFactor.emailAddressId,
      });
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setIsEmailLoading(false);
    }
  };

  const selectEmailMode = (mode: EmailMode) => {
    setEmailMode(mode);
    setVerificationMode(null);
    setVerificationCode("");
    setError(null);
  };

  const leaveVerification = () => {
    setVerificationMode(null);
    setVerificationCode("");
    setError(null);
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingVertical: 24,
          }}
        >
          <View className="items-center gap-8">
            <View className="items-center gap-4 px-6">
              <Text className="text-foreground text-center font-serif text-4xl">
                Plan. Eat. Repeat.
              </Text>
              <Text className="text-muted-foreground text-center text-base">
                Effortlessly organize meals and plan your week with your
                household.
              </Text>
            </View>

            <View className="w-full max-w-md gap-4 px-6">
              {verificationMode ? (
                <View className="gap-4">
                  <View className="gap-1">
                    <Text className="text-foreground font-sans text-lg font-semibold">
                      Verify your email
                    </Text>
                    <Text className="text-muted-foreground text-sm">
                      Enter the verification code sent to {trimmedEmailAddress}.
                    </Text>
                  </View>

                  <Input
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    placeholder="Verification code"
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    returnKeyType="done"
                    onSubmitEditing={() => void verifyEmail()}
                    editable={!isBusy}
                  />
                  <Button
                    className="w-full"
                    disabled={!canVerifyEmail}
                    onPress={() => void verifyEmail()}
                  >
                    {isEmailLoading ? "Verifying..." : "Verify email"}
                  </Button>
                  <View className="flex-row justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isBusy}
                      onPress={() => void resendVerificationCode()}
                    >
                      Resend code
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isBusy}
                      onPress={leaveVerification}
                    >
                      Use another email
                    </Button>
                  </View>
                </View>
              ) : (
                <>
                  <View className="bg-secondary flex-row rounded-lg p-1">
                    <Button
                      className="flex-1"
                      size="sm"
                      variant={emailMode === "signIn" ? "default" : "ghost"}
                      disabled={isBusy}
                      onPress={() => selectEmailMode("signIn")}
                    >
                      Sign in
                    </Button>
                    <Button
                      className="flex-1"
                      size="sm"
                      variant={emailMode === "signUp" ? "default" : "ghost"}
                      disabled={isBusy}
                      onPress={() => selectEmailMode("signUp")}
                    >
                      Create account
                    </Button>
                  </View>

                  <View className="gap-3">
                    {emailMode === "signUp" && (
                      <>
                        <Input
                          value={firstName}
                          onChangeText={setFirstName}
                          placeholder="First name"
                          autoCapitalize="words"
                          autoComplete="given-name"
                          textContentType="givenName"
                          returnKeyType="next"
                          editable={!isBusy}
                        />
                        <Input
                          value={lastName}
                          onChangeText={setLastName}
                          placeholder="Last name"
                          autoCapitalize="words"
                          autoComplete="family-name"
                          textContentType="familyName"
                          returnKeyType="next"
                          editable={!isBusy}
                        />
                      </>
                    )}
                    <Input
                      value={emailAddress}
                      onChangeText={setEmailAddress}
                      placeholder="Email address"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                      returnKeyType="next"
                      editable={!isBusy}
                    />
                    <Input
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Password"
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete={
                        emailMode === "signUp"
                          ? "new-password"
                          : "current-password"
                      }
                      textContentType={
                        emailMode === "signUp" ? "newPassword" : "password"
                      }
                      returnKeyType="go"
                      onSubmitEditing={() => void startEmailAuth()}
                      editable={!isBusy}
                    />
                    <Button
                      className="w-full"
                      disabled={!canSubmitEmail}
                      onPress={() => void startEmailAuth()}
                    >
                      {isEmailLoading
                        ? emailMode === "signUp"
                          ? "Creating account..."
                          : "Signing in..."
                        : emailMode === "signUp"
                          ? "Create account"
                          : "Sign in with email"}
                    </Button>
                  </View>

                  <View className="flex-row items-center gap-3">
                    <View className="bg-border h-px flex-1" />
                    <Text className="text-muted-foreground text-xs">or</Text>
                    <View className="bg-border h-px flex-1" />
                  </View>

                  <Button
                    onPress={() => startProvider("oauth_google")}
                    disabled={isBusy}
                    className="w-full"
                  >
                    {loadingProvider === "oauth_google"
                      ? "Signing in..."
                      : "Continue with Google"}
                  </Button>

                  {Platform.OS === "ios" && (
                    <Button
                      variant="outline"
                      onPress={() => startProvider("oauth_apple")}
                      disabled={isBusy}
                      className="w-full"
                    >
                      {loadingProvider === "oauth_apple"
                        ? "Signing in..."
                        : "Continue with Apple"}
                    </Button>
                  )}
                  {showDevBypass && (
                    <Button
                      variant="outline"
                      onPress={() => {
                        void signInWithDevBypass();
                      }}
                      disabled={isBusy}
                      className="w-full"
                    >
                      Local login
                    </Button>
                  )}
                </>
              )}

              {error && (
                <Text className="text-destructive text-center text-xs">
                  {error}
                </Text>
              )}
            </View>

            <Text className="text-muted-foreground text-xs">
              By continuing you agree to the PlanEatRepeat terms.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const getAuthErrorMessage = (error: unknown) => {
  if (isClerkAPIResponseError(error)) {
    return (
      error.errors[0]?.longMessage ??
      error.errors[0]?.message ??
      "Authentication failed"
    );
  }

  return error instanceof Error ? error.message : "Authentication failed";
};
