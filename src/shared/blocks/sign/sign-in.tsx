'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { authClient, signIn } from '@/core/auth/client';
import { Link, useRouter as I18nRouter } from '@/core/i18n/navigation';
import { defaultLocale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import { SocialProviders } from './social-providers';

export function SignIn({
  configs,
  callbackUrl = '/',
  defaultEmail = '',
}: {
  configs: Record<string, string>;
  callbackUrl: string;
  defaultEmail?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const i18nRouter = I18nRouter();
  const locale = useLocale();
  const t = useTranslations('common.sign');
  const [email, setEmail] = useState(defaultEmail || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginBlocked, setLoginBlocked] = useState(false);

  const isGoogleAuthEnabled = configs.google_auth_enabled === 'true';
  const isGithubAuthEnabled = configs.github_auth_enabled === 'true';
  const isEmailAuthEnabled =
    configs.email_auth_enabled !== 'false' ||
    (!isGoogleAuthEnabled && !isGithubAuthEnabled); // no social providers enabled, auto enable email auth

  // Use callbackUrl from props or search params
  const finalCallbackUrl = callbackUrl || searchParams.get('callbackUrl') || '/';

  if (finalCallbackUrl) {
    if (
      locale !== defaultLocale &&
      finalCallbackUrl.startsWith('/') &&
      !finalCallbackUrl.startsWith(`/${locale}`)
    ) {
      callbackUrl = `/${locale}${finalCallbackUrl}`;
    }
  }

  // 使用页面内定义的函数替代导入
  const base = locale !== defaultLocale ? `/${locale}` : '';
  const stripLocalePrefix = (path: string) => {
    if (!path?.startsWith('/')) return '/';
    if (locale === defaultLocale) return path;
    if (path === `/${locale}`) return '/';
    if (path.startsWith(`/${locale}/`))
      return path.slice(locale.length + 1) || '/';
    return path;
  };

  // 检查登录限制
  useEffect(() => {
    const checkLoginLimit = async () => {
      try {
        const response = await fetch('/api/auth/check-login-limit');
        if (response.ok) {
          const data = await response.json();
          setLoginBlocked(data.remainingAttempts === 0);
        }
      } catch (error) {
        console.error('检查登录限制失败:', error);
      }
    };

    checkLoginLimit();
  }, []);

  const handleSignIn = async () => {
    if (loading) {
      return;
    }

    if (!email || !password) {
      toast.error(t('email_password_required'));
      return;
    }

    // 检查是否被封禁
    if (loginBlocked) {
      toast.error(t('login_attempts_exceeded'));
      return;
    }

    // Set loading immediately to avoid duplicate submits before request hooks fire.
    setLoading(true);

    try {
      await signIn.email(
        {
          email,
          password,
          callbackURL: callbackUrl,
        },
        {
          onRequest: (ctx) => {
            // loading is already set above; keep as no-op for safety
          },
          onResponse: (ctx) => {
            // Do NOT reset loading here; navigation may not have completed yet.
          },
          onSuccess: (ctx) => {
            // Keep loading=true until navigation completes.
          },
          onError: (e: any) => {
            const status = e?.error?.status;
            if (status === 403) {
              const normalizedCallbackUrl = stripLocalePrefix(finalCallbackUrl);
              const verifyPath = `/verify-email?sent=1&email=${encodeURIComponent(
                email
              )}&callbackUrl=${encodeURIComponent(normalizedCallbackUrl)}`;

              // IMPORTANT:
              // better-auth does not URL-encode callbackURL when generating the verification URL.
              // So callbackURL must not contain its own '&' query params (or they'll get split).
              // We send users to home/callbackUrl after verification, and keep the verify page only
              // as the waiting UI.
              void authClient.sendVerificationEmail({
                email,
                callbackURL: `${base}${normalizedCallbackUrl || '/'}`,
              });

              // i18n router will prefix locale automatically; do NOT include locale here.
              i18nRouter.push(verifyPath);
              return;
            }

            // 更新封禁状态
            if (e?.error?.errorCode === 'LOGIN_LIMIT_EXCEEDED') {
              setLoginBlocked(true);
            }

            toast.error(e?.error?.message || t('sign_in_failed'));
            setLoading(false);
          },
        }
      );
    } catch (e: any) {
      toast.error(e?.message || 'sign in failed');
      setLoading(false);
    }
  };

  return (
    <Card className="mx-auto w-full md:max-w-md">
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">
          <h1>{t('sign_in_title')}</h1>
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          <h2>{t('sign_in_description')}</h2>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loginBlocked && (
          <div className="mb-4 rounded-md bg-red-50 p-3 dark:bg-red-900/20">
            <p className="text-sm text-red-800 dark:text-red-200">
              ⚠️ {t('login_attempts_exceeded_detail', { 
                hours: process.env.NEXT_PUBLIC_RISK_CONTROL_RESET_HOURS || '24' 
              })}
            </p>
          </div>
        )}
        
        <div className="grid gap-4">
          {isEmailAuthEnabled && loginBlocked ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                {t('login_attempts_exceeded_detail', { 
                  hours: process.env.NEXT_PUBLIC_RISK_CONTROL_RESET_HOURS || '24' 
                })}
              </p>
              <Button 
                onClick={() => router.refresh()} 
                variant="outline"
              >
                {t('refresh_page')}
              </Button>
            </div>
          ) : isEmailAuthEnabled && (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSignIn();
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="email">{t('email_title')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('email_placeholder')}
                  required
                  onChange={(e) => {
                    setEmail(e.target.value);
                  }}
                  value={email}
                  disabled={loading}
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">{t('password_title')}</Label>
                  {/* <Link
                    href="#"
                    className="ml-auto inline-block text-sm underline"
                  >
                    Forgot your password?
                  </Link> */}
                </div>

                <Input
                  id="password"
                  type="password"
                  placeholder={t('password_placeholder')}
                  required
                  onChange={(e) => {
                    setPassword(e.target.value);
                  }}
                  value={password}
                  disabled={loading}
                />
              </div>

              {/* <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              onClick={() => {
                setRememberMe(!rememberMe);
              }}
            />
            <Label htmlFor="remember">Remember me</Label>
          </div> */}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || loginBlocked}
              >
                {loading ? t('signing_in') : t('sign_in_title')}
              </Button>
            </form>
          )}

          <SocialProviders
            configs={configs}
            callbackUrl={callbackUrl || '/'}
            loading={loading}
            setLoading={setLoading}
          />
        </div>
      </CardContent>
      {isEmailAuthEnabled && !loginBlocked && (
        <CardFooter>
          <div className="flex w-full justify-center border-t py-4">
            <p className="text-center text-xs text-neutral-500">
              {t('no_account')}
              <Link href="/sign-up" className="underline">
                <span className="cursor-pointer dark:text-white/70">
                  {t('sign_up_title')}
                </span>
              </Link>
            </p>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
