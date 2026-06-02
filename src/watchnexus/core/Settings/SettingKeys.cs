namespace WatchNexus.Core.Settings;

/// <summary>
/// Central registry of all configuration keys used across WatchNexus.
/// QLT-10: Replace hardcoded string literals with these constants.
/// </summary>
public static class SettingKeys
{
    // ── License / Tier ──
    public const string CellarLicense = "cellar_license";
    public const string FortressManifest = "fortress_manifest";

    // ── Bastion (Auth) ──
    public const string BastionConfig = "bastion_config";

    // ── Media / TMDB ──
    public const string TmdbApiKey = "tmdb_api_key";

    // ── Streaming ──
    public const string StreamingLogins = "streaming_logins";

    // ── Subtitles ──
    public const string SubtitleSettings = "subtitle_settings";

    // ── Network / Tunnel ──
    public const string TunnelConfig = "tunnel_config";

    // ── Module configurations ──
    public const string StrudelConfig = "strudel_config";
    public const string StrudelProfiles = "strudel_profiles";
    public const string CrumbsConfig = "crumbs_config";
    public const string CrucibleConfig = "crucible_config";
    public const string RindConfig = "rind_config";
    public const string PepperConfig = "pepper_config";
    public const string MenuConfig = "menu_config";
    public const string ParfaitConfig = "parfait_config";
    public const string PretzelConfig = "pretzel_config";
    public const string MeringueConfig = "meringue_config";
    public const string CellarConfig = "cellar_config";
    public const string DrizzleConfig = "drizzle_config";
    public const string LadleConfig = "ladle_config";
    public const string BrineConfig = "brine_config";
    public const string SproutConfig = "sprout_config";
    public const string FeatureDisabled = "feature_disabled";
    public const string ThemeCustom = "theme_custom";

    // ── Settings ──
    public const string MediaDirectories = "media_directories";
    public const string QualityProfiles = "quality_profiles";
    public const string WatchPartyConfig = "watch_party_config";

    // ── Refresh Tokens ──
    public const string RefreshToken = "refresh_token";

    // ── QoL Profiles ──
    public const string QualityProfileDefaults = "quality_profile_defaults";
}
