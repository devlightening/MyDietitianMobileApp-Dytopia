using Microsoft.Extensions.Configuration;

namespace MyDietitianMobileApp.Application.Services;

public static class EmailPolicy
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Comprehensive allowlist of globally recognised e-mail providers.
    //  Sources: market-share data + RFC 2606 & IANA reserved TLD awareness.
    //  Add new domains here; no code-path changes needed.
    // ─────────────────────────────────────────────────────────────────────────
    private static readonly HashSet<string> DefaultAllowedDomains = new(StringComparer.OrdinalIgnoreCase)
    {
        // ── Google ────────────────────────────────────────────────────────────
        "gmail.com", "googlemail.com",

        // ── Microsoft ─────────────────────────────────────────────────────────
        "outlook.com", "outlook.com.tr", "outlook.com.br", "outlook.co.uk",
        "outlook.de", "outlook.fr", "outlook.it", "outlook.es", "outlook.jp",
        "hotmail.com", "hotmail.co.uk", "hotmail.fr", "hotmail.de",
        "hotmail.it", "hotmail.es", "hotmail.com.tr", "hotmail.com.br",
        "hotmail.com.ar", "hotmail.com.au", "hotmail.co.jp",
        "live.com", "live.co.uk", "live.com.tr", "live.com.br",
        "live.fr", "live.de", "live.it", "live.es", "live.nl", "live.be",
        "live.com.ar", "live.com.au", "live.com.mx", "live.ca",
        "msn.com", "windowslive.com",

        // ── Apple ─────────────────────────────────────────────────────────────
        "icloud.com", "me.com", "mac.com",

        // ── Yahoo ─────────────────────────────────────────────────────────────
        "yahoo.com", "yahoo.co.uk", "yahoo.co.jp", "yahoo.fr", "yahoo.de",
        "yahoo.it", "yahoo.es", "yahoo.com.br", "yahoo.com.ar",
        "yahoo.com.au", "yahoo.com.mx", "yahoo.ca", "yahoo.in",
        "yahoo.gr", "yahoo.co.id", "yahoo.com.sg", "yahoo.com.ph",
        "ymail.com", "rocketmail.com",

        // ── Yandex ────────────────────────────────────────────────────────────
        "yandex.com", "yandex.ru", "yandex.tr", "yandex.kz",
        "yandex.by", "yandex.ua", "ya.ru",

        // ── Mail.ru group ─────────────────────────────────────────────────────
        "mail.ru", "inbox.ru", "list.ru", "bk.ru", "internet.ru",

        // ── ProtonMail / Proton ───────────────────────────────────────────────
        "protonmail.com", "protonmail.ch", "proton.me", "pm.me",

        // ── Tutanota / Tuta ───────────────────────────────────────────────────
        "tutanota.com", "tutanota.de", "tutamail.com", "tuta.com", "keemail.me",

        // ── GMX ───────────────────────────────────────────────────────────────
        "gmx.com", "gmx.net", "gmx.de", "gmx.at", "gmx.ch",
        "gmx.us", "gmx.fr", "gmx.es", "gmx.co.uk",

        // ── Web.de / Mail.com / 1&1 ───────────────────────────────────────────
        "web.de", "mail.com", "email.com", "usa.com", "myself.com",
        "cheerful.com", "consultant.com", "eml.cc",

        // ── Zoho ──────────────────────────────────────────────────────────────
        "zoho.com", "zohomail.com",

        // ── Fastmail ──────────────────────────────────────────────────────────
        "fastmail.com", "fastmail.fm", "fastmail.to", "fastmail.net",
        "fastmail.org", "fastmail.cn", "fastmail.es",
        "fastmail.de", "fastmail.jp", "fastmail.us",

        // ── Hey / Basecamp ────────────────────────────────────────────────────
        "hey.com",

        // ── Mailbox.org / Posteo ──────────────────────────────────────────────
        "mailbox.org", "posteo.de", "posteo.net", "posteo.org",
        "posteo.eu", "posteo.at", "posteo.ch",

        // ── AOL / Verizon ─────────────────────────────────────────────────────
        "aol.com", "aim.com", "verizon.net",

        // ── US ISPs ───────────────────────────────────────────────────────────
        "comcast.net", "att.net", "sbcglobal.net", "bellsouth.net",
        "cox.net", "charter.net", "earthlink.net", "juno.com",
        "netzero.com", "windstream.net",

        // ── UK providers ──────────────────────────────────────────────────────
        "btinternet.com", "btopenworld.com", "talktalk.net",
        "virginmedia.com", "sky.com", "tiscali.co.uk",
        "ntlworld.com", "blueyonder.co.uk", "plus.net",

        // ── French providers ──────────────────────────────────────────────────
        "orange.fr", "free.fr", "sfr.fr", "wanadoo.fr",
        "laposte.net", "bbox.fr", "numericable.fr",

        // ── German providers ──────────────────────────────────────────────────
        "t-online.de", "freenet.de", "arcor.de", "telekom.de",
        "kabel.de", "1und1.de",

        // ── Italian providers ─────────────────────────────────────────────────
        "alice.it", "libero.it", "virgilio.it", "tin.it",
        "tiscali.it", "email.it",

        // ── Spanish providers ─────────────────────────────────────────────────
        "telefonica.net", "terra.es", "ono.com", "ya.com",

        // ── Brazilian providers ───────────────────────────────────────────────
        "terra.com.br", "bol.com.br", "uol.com.br",
        "ig.com.br", "globo.com", "r7.com", "oi.com.br",

        // ── Turkish providers ─────────────────────────────────────────────────
        "mynet.com", "ttmail.com", "ttnet.net.tr",
        "superonline.net", "turk.net", "e-kolay.net",

        // ── Indian providers ──────────────────────────────────────────────────
        "rediffmail.com", "indiatimes.com", "sify.com",
        "in.com", "dataone.in",

        // ── Korean / CJK providers ────────────────────────────────────────────
        "naver.com", "hanmail.net", "daum.net", "kakao.com",
        "nate.com", "qq.com", "163.com", "126.com", "sina.com",
        "sohu.com", "aliyun.com", "foxmail.com",

        // ── Russian / CIS providers ───────────────────────────────────────────
        "rambler.ru", "ukr.net", "i.ua", "bigmir.net",

        // ── Other global providers ────────────────────────────────────────────
        "iinet.net.au", "bigpond.com", "bigpond.net.au",
        "optusnet.com.au", "aapt.net.au",
        "sympatico.ca", "shaw.ca", "rogers.com", "telus.net",
        "bell.net",
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  Blocked TLDs — RFC 2606 reserved + obviously fake / local extensions.
    //  Even if someone somehow bypasses the allowlist, these are always rejected.
    // ─────────────────────────────────────────────────────────────────────────
    private static readonly HashSet<string> BlockedTlds = new(StringComparer.OrdinalIgnoreCase)
    {
        "local", "localhost", "test", "example", "invalid",
        "internal", "intranet", "corp", "home", "lan",
        "localdomain", "domain", "private", "workgroup",
        "arpa", "mail", "email",   // reserved / infrastructure
    };

    // Disposable / throwaway mail services (common ones)
    private static readonly HashSet<string> DisposableDomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "mailinator.com", "guerrillamail.com", "guerrillamail.net",
        "guerrillamail.org", "guerrillamail.biz", "guerrillamail.de",
        "throwam.com", "throwaway.email", "trashmail.com",
        "trashmail.me", "trashmail.net", "trashmail.org",
        "yopmail.com", "yopmail.fr", "yopmail.net",
        "sharklasers.com", "spam4.me", "spamgourmet.com",
        "10minutemail.com", "10minutemail.net", "10minemail.com",
        "dispostable.com", "discard.email", "maildrop.cc",
        "fakeinbox.com", "tempmail.com", "tempr.email",
        "temp-mail.org", "getnada.com", "mailnull.com",
        "spamfree24.org", "spamfree.eu", "spam.la",
        "binkmail.com", "bobmail.info", "dayrep.com",
        "einrot.com", "fleckens.hu", "gustr.com",
        "iroid.com", "jetable.fr.nf", "klzlk.com",
        "lroid.com", "maileater.com", "meltmail.com",
        "nospamfor.us", "objectmail.com", "obobbo.com",
        "rppkn.com", "spamgourmet.net", "spamgourmet.org",
        "superrito.com", "superstachel.de", "tempe-mail.com",
        "tradermail.info", "trbvm.com", "turual.com",
        "uroid.com", "veryrealemail.com", "victime.ninja",
        "wetrainbayarea.org", "wh4f.org", "xagloo.com",
        "yapped.net", "yesboxing.net", "zehnminuten.de",
        "zoemail.net", "zippymail.info",
    };

    public static (bool IsAllowed, string NormalizedEmail, string? ErrorCode, string? ErrorMessage) ValidateAllowedDomain(
        string email,
        IConfiguration config)
    {
        var normalizedEmail = (email ?? string.Empty).Trim().ToLowerInvariant();

        // Basic format check
        var atIndex = normalizedEmail.LastIndexOf('@');
        if (atIndex <= 0 || atIndex == normalizedEmail.Length - 1)
            return (false, normalizedEmail, "INVALID_EMAIL", "Geçerli bir e-posta adresi giriniz.");

        var domain = normalizedEmail[(atIndex + 1)..].Trim();

        // Must have at least one dot in the domain part
        var dotIndex = domain.LastIndexOf('.');
        if (dotIndex <= 0 || dotIndex == domain.Length - 1)
            return (false, normalizedEmail, "INVALID_EMAIL", "Geçerli bir e-posta adresi giriniz.");

        var tld = domain[(dotIndex + 1)..];

        // ── Always block reserved / fake TLDs ────────────────────────────────
        if (BlockedTlds.Contains(tld))
            return (false, normalizedEmail, "EMAIL_DOMAIN_NOT_ALLOWED",
                "Bu e-posta uzantısı kabul edilmiyor. Gerçek bir e-posta adresi kullanın.");

        // ── Always block disposable / throwaway services ──────────────────────
        if (DisposableDomains.Contains(domain))
            return (false, normalizedEmail, "EMAIL_DOMAIN_NOT_ALLOWED",
                "Geçici e-posta servisleri kabul edilmiyor. Kalıcı bir e-posta adresi kullanın.");

        // ── Check allowlist from configuration ────────────────────────────────
        var configSection = config.GetSection("AuthSecurity:AllowedEmailDomains");
        var fromConfig = configSection.GetChildren()
            .Select(c => c.Value)
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Select(v => v!)
            .ToArray();

        var allowed = (fromConfig is { Length: > 0 } ? fromConfig : DefaultAllowedDomains.ToArray())
            .Select(d => d.Trim().ToLowerInvariant())
            .Where(d => !string.IsNullOrWhiteSpace(d))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        // "*" = allow all (development/testing override only)
        if (allowed.Contains("*"))
            return (true, normalizedEmail, null, null);

        if (!allowed.Contains(domain))
            return (false, normalizedEmail, "EMAIL_DOMAIN_NOT_ALLOWED",
                "Bu e-posta uzantısı desteklenmiyor. Gmail, Outlook, iCloud veya yaygın bir sağlayıcı kullanın.");

        return (true, normalizedEmail, null, null);
    }
}
