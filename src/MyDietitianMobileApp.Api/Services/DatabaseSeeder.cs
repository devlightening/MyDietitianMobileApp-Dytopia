using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace MyDietitianMobileApp.Api.Services;

public class DatabaseSeeder
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DatabaseSeeder> _logger;
    private readonly IHostEnvironment _environment;

    public DatabaseSeeder(
        IServiceProvider serviceProvider,
        ILogger<DatabaseSeeder> logger,
        IHostEnvironment environment)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _environment = environment;
    }

    public async Task SeedAsync()
    {
        // Only seed in Development environment
        if (!_environment.IsDevelopment())
        {
            _logger.LogInformation("Skipping database seeding (not in Development environment)");
            return;
        }

        using var scope = _serviceProvider.CreateScope();
        var appDbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var authDbContext = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
        var passwordHasher = scope.ServiceProvider.GetRequiredService<PasswordHasherService>();

        try
        {
            // Seed dev dietitian user
            var dietitianExists = await appDbContext.Dietitians.AnyAsync();
            if (!dietitianExists)
            {
                _logger.LogInformation("No dietitians found. Creating dev seed user...");
                var dietitianId = Guid.NewGuid();
                var publicUserId = Guid.NewGuid().ToString();

                var dietitian = new Dietitian(
                    id: dietitianId,
                    fullName: "Dev Dietitian",
                    clinicName: "Dev Clinic",
                    isActive: true
                );

                var userAccount = new UserAccount(
                    id: Guid.NewGuid(),
                    email: "dev@dietitian.com",
                    passwordHash: passwordHasher.HashPassword("dev123"),
                    role: "Dietitian",
                    fullName: "Dev Dietitian"
                );
                userAccount.SetPublicUserId(publicUserId);
                userAccount.LinkedDietitianId = dietitianId;

                appDbContext.Dietitians.Add(dietitian);
                authDbContext.UserAccounts.Add(userAccount);
                await appDbContext.SaveChangesAsync();
                await authDbContext.SaveChangesAsync();

                _logger.LogWarning("========================================");
                _logger.LogWarning("DEV SEED USER CREATED:");
                _logger.LogWarning("Email: dev@dietitian.com");
                _logger.LogWarning("Password: dev123");
                _logger.LogWarning("Role: Dietitian");
                _logger.LogWarning("========================================");
            }
            else
            {
                _logger.LogInformation("Dietitians already exist. Skipping dietitian seed.");
            }

            // Always run ingredient + taxonomy seeding (idempotent)
            await SeedOperationalIngredientDatasetAsync(appDbContext);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error seeding database");
            throw;
        }
    }

    private async Task SeedOperationalIngredientDatasetAsync(AppDbContext db)
    {
        _logger.LogInformation("Seeding operational ingredient dataset...");

        // =====================================================================
        // STEP 1: Seed all ingredients idempotently
        // =====================================================================

        var ingredientDefinitions = GetIngredientDefinitions();
        var allCanonicalNames = ingredientDefinitions.Select(x => x.CanonicalName).ToHashSet();

        // Load existing by canonical name
        var existing = await db.Ingredients
            .Where(i => allCanonicalNames.Contains(i.CanonicalName))
            .ToDictionaryAsync(i => i.CanonicalName);

        foreach (var def in ingredientDefinitions)
        {
            if (existing.TryGetValue(def.CanonicalName, out var ingredient))
            {
                // Ensure active
                if (!ingredient.IsActive)
                    ingredient.SetIsActive(true);

                // Merge aliases idempotently
                foreach (var alias in def.Aliases)
                    ingredient.AddAlias(alias);
            }
            else
            {
                var newIngredient = new Ingredient(Guid.NewGuid(), def.CanonicalName, isActive: true);
                foreach (var alias in def.Aliases)
                    newIngredient.AddAlias(alias);

                db.Ingredients.Add(newIngredient);
            }
        }

        await db.SaveChangesAsync();
        _logger.LogInformation("Ingredient seed complete.");

        // =====================================================================
        // STEP 2: Reload ingredients into dictionary after upsert
        // =====================================================================

        var allIngredients = await db.Ingredients
            .Where(i => allCanonicalNames.Contains(i.CanonicalName))
            .ToDictionaryAsync(i => i.CanonicalName);

        // =====================================================================
        // STEP 3: Seed ingredient families
        // =====================================================================

        var familyDefinitions = GetFamilyDefinitions();
        var existingFamilies = await db.IngredientFamilies
            .ToDictionaryAsync(f => f.Name);

        foreach (var fam in familyDefinitions)
        {
            if (!existingFamilies.ContainsKey(fam.Name))
            {
                var newFamily = new IngredientFamily(Guid.NewGuid(), fam.Name, fam.Description, fam.SortOrder);
                db.IngredientFamilies.Add(newFamily);
                existingFamilies[fam.Name] = newFamily;
            }
        }

        await db.SaveChangesAsync();
        _logger.LogInformation("Family seed complete.");

        // =====================================================================
        // STEP 4: Seed family members
        // =====================================================================

        var familyMemberDefinitions = GetFamilyMemberDefinitions();

        foreach (var (familyName, canonicalName, role) in familyMemberDefinitions)
        {
            if (!existingFamilies.TryGetValue(familyName, out var family)) continue;
            if (!allIngredients.TryGetValue(canonicalName, out var ingredient)) continue;

            await EnsureFamilyMember(db, family.Id, ingredient.Id, role);
        }

        await db.SaveChangesAsync();
        _logger.LogInformation("Family member seed complete.");

        // =====================================================================
        // STEP 5: Seed compatibility rules
        // =====================================================================

        var compatibilityRules = GetCompatibilityRuleDefinitions();

        foreach (var (reqName, candName, compatType) in compatibilityRules)
        {
            if (!allIngredients.TryGetValue(reqName, out var req)) continue;
            if (!allIngredients.TryGetValue(candName, out var cand)) continue;

            await EnsureCompatibilityRule(db, req.Id, cand.Id, compatType);
        }

        await db.SaveChangesAsync();
        _logger.LogInformation("Compatibility rule seed complete.");

        // =====================================================================
        // STEP 6: Seed ingredient packs
        // =====================================================================

        await SeedIngredientPacksAsync(db, allIngredients);

        _logger.LogInformation("Operational ingredient dataset seed complete.");
    }

    // =========================================================================
    // DATA DEFINITIONS
    // =========================================================================

    private record IngredientDef(string CanonicalName, List<string> Aliases);

    private static List<IngredientDef> GetIngredientDefinitions() => new()
    {
        // --- Yoğurt Ailesi ---
        new("Yoğurt", new() { "yogurt", "yoğurt", "süt yoğurdu" }),
        new("Meyveli Yoğurt", new() { "meyveli yogurt", "aromalı yoğurt", "çilekli yoğurt" }),
        new("Süzme Yoğurt", new() { "süzme yogurt", "krem yoğurt", "koyun yoğurdu" }),
        new("Laktozsuz Yoğurt", new() { "laktozsuz yogurt", "laktoz-free yoğurt" }),

        // --- Süt Ailesi ---
        new("Süt", new() { "inek sütü", "tam yağlı süt", "yarım yağlı süt" }),
        new("Laktozsuz Süt", new() { "laktozsuz inek sütü", "laktoz-free süt" }),
        new("Badem Sütü", new() { "badem milk", "unsweetened badem sütü" }),
        new("Yulaf Sütü", new() { "oat milk", "yulaf bazlı süt" }),
        new("Soya Sütü", new() { "soy milk", "soya bazlı süt" }),
        new("Hindistan Cevizi Sütü", new() { "coconut milk", "hindistan cevizi kremi" }),

        // --- Peynir Ailesi ---
        new("Beyaz Peynir", new() { "feta peyniri", "tuzsuz beyaz peynir", "inek peyniri" }),
        new("Kaşar Peyniri", new() { "eski kaşar", "taze kaşar", "kaşar" }),
        new("Cottage Cheese", new() { "lor peyniri", "süzme lor" }),
        new("Ricotta", new() { "ricotta peyniri" }),
        new("Mozzarella", new() { "mozzarella peyniri", "taze mozzarella" }),

        // --- Yumurta Ailesi ---
        new("Yumurta", new() { "tavuk yumurtası", "büyük yumurta", "organik yumurta" }),
        new("Bıldırcın Yumurtası", new() { "bıldırcın yumurtaları" }),

        // --- Tahıl Ailesi ---
        new("Pirinç", new() { "beyaz pirinç", "uzun taneli pirinç", "jasmine pirinç" }),
        new("Esmer Pirinç", new() { "tam tahıl pirinç", "brown rice" }),
        new("Makarna", new() { "spagetti", "penne", "fusilli", "rigatoni" }),
        new("Tam Buğday Makarnası", new() { "whole wheat pasta", "tam tahıl makarna" }),
        new("Yulaf Ezmesi", new() { "yulaf", "oat", "rolled oats", "instant oatmeal" }),
        new("Kinoa", new() { "quinoa", "quinoa taneleri" }),
        new("Bulgur", new() { "bulgur pilavı", "büyük bulgur", "köfte bulguru" }),
        new("Arpa", new() { "arpa taneleri", "barley" }),

        // --- Ekmek Ailesi ---
        new("Tam Buğday Ekmeği", new() { "tam tahıl ekmek", "esmer ekmek", "kepekli ekmek" }),
        new("Beyaz Ekmek", new() { "ekmek", "francala", "sandviç ekmeği" }),
        new("Pita Ekmeği", new() { "pide ekmeği", "lavaş", "yufka" }),
        new("Çavdar Ekmeği", new() { "rye bread", "siyah ekmek" }),

        // --- Meyve Ailesi ---
        new("Elma", new() { "kırmızı elma", "yeşil elma", "granny smith" }),
        new("Muz", new() { "olgun muz", "yeşil muz" }),
        new("Portakal", new() { "kan portakalı", "navel portakal" }),
        new("Çilek", new() { "taze çilek", "organik çilek" }),
        new("Üzüm", new() { "kırmızı üzüm", "yeşil üzüm", "çekirdeksiz üzüm" }),
        new("Kivi", new() { "taze kivi", "yeşil kivi" }),
        new("Şeftali", new() { "olgun şeftali", "beyaz şeftali" }),
        new("Armut", new() { "sarı armut", "deveci armudu" }),

        // --- Sebze Ailesi ---
        new("Domates", new() { "cherry domates", "salkım domates", "konserve domates" }),
        new("Salatalık", new() { "taze salatalık", "turşu salatalık" }),
        new("Havuç", new() { "taze havuç", "organik havuç", "bebek havuç" }),
        new("Ispanak", new() { "taze ıspanak", "bebek ıspanak", "dondurulmuş ıspanak" }),
        new("Brokoli", new() { "taze brokoli", "dondurulmuş brokoli" }),
        new("Kapya Biber", new() { "kırmızı biber", "dolmalık biber" }),
        new("Kabak", new() { "yeşil kabak", "sakız kabağı", "zucchini" }),
        new("Soğan", new() { "kuru soğan", "beyaz soğan", "kırmızı soğan" }),
        new("Sarımsak", new() { "taze sarımsak", "sarımsak tozu" }),
        new("Patates", new() { "sarı patates", "tatlı patates", "kumpir patatesi" }),
        new("Patlıcan", new() { "kemer patlıcanı", "çarliston patlıcanı" }),
        new("Mısır", new() { "tatlı mısır", "konserve mısır", "dondurulmuş mısır" }),

        // --- Bakliyat Ailesi ---
        new("Mercimek", new() { "kırmızı mercimek", "yeşil mercimek", "sarı mercimek" }),
        new("Nohut", new() { "haşlanmış nohut", "konserve nohut", "kuru nohut" }),
        new("Fasulye", new() { "beyaz fasulye", "kuru fasulye", "pinto fasulye" }),
        new("Barbunya", new() { "pinto fasulyesi", "barbunya pilaki" }),
        new("Bezelye", new() { "yeşil bezelye", "dondurulmuş bezelye", "taze bezelye" }),
        new("Edamame", new() { "soya fasulyesi", "haşlanmış edamame" }),

        // --- Et ve Tavuk Ailesi ---
        new("Tavuk Göğsü", new() { "haşlanmış tavuk", "ızgara tavuk göğsü", "tavuk fileto" }),
        new("Tavuk But", new() { "tavuk bacağı", "bütçe bud" }),
        new("Dana Kıyma", new() { "yağlı kıyma", "kıyma", "yağsız dana kıyma" }),
        new("Dana Eti", new() { "bonfile", "biftek", "kuşbaşı dana" }),
        new("Hindi Göğsü", new() { "hindi fileto", "ızgara hindi" }),
        new("Kuzu Eti", new() { "kuzu pirzola", "kuzu kol", "kuzu kıyma" }),

        // --- Balık Ailesi ---
        new("Somon", new() { "taze somon", "dondurulmuş somon", "atlantik somonu" }),
        new("Ton Balığı", new() { "konserve ton balığı", "su da ton balığı", "sıvı yağda ton" }),
        new("Hamsi", new() { "taze hamsi", "hamsikoli" }),
        new("Levrek", new() { "sea bass", "çipura levrek" }),
        new("Çipura", new() { "sea bream", "taze çipura" }),
        new("Sardalya", new() { "konserve sardalya", "taze sardalya" }),

        // --- Yağ ve Sos Ailesi ---
        new("Zeytinyağı", new() { "sızma zeytinyağı", "riviera zeytinyağı", "extravirgin zeytinyağı" }),
        new("Tereyağı", new() { "taze tereyağı", "tuzsuz tereyağı", "salted butter" }),
        new("Ayçiçek Yağı", new() { "bitkisel yağ", "ayçiçeği yağı" }),
        new("Hindistan Cevizi Yağı", new() { "coconut oil", "soğuk sıkım hindistan yağı" }),
        new("Tahini", new() { "susam ezmesi", "beyaz tahin" }),
        new("Yer Fıstığı Ezmesi", new() { "peanut butter", "fıstık ezmesi" }),

        // --- Kuruyemiş ve Tohum Ailesi ---
        new("Badem", new() { "çiğ badem", "kavrulmuş badem", "tuzlu badem" }),
        new("Ceviz", new() { "taze ceviz", "iç ceviz" }),
        new("Fındık", new() { "iç fındık", "kavrulmuş fındık" }),
        new("Kaju", new() { "çiğ kaju", "tuzlu kaju" }),
        new("Chia Tohumu", new() { "chia seeds", "chia" }),
        new("Keten Tohumu", new() { "flaxseed", "öğütülmüş keten" }),
        new("Ayçiçeği Çekirdeği", new() { "sunflower seeds", "çiğlem" }),
        new("Susam", new() { "beyaz susam", "susam tohumu" }),

        // --- Baharat Ailesi ---
        new("Tuz", new() { "kaya tuzu", "deniz tuzu", "iyotlu tuz" }),
        new("Karabiber", new() { "taze öğütülmüş biber", "siyah biber" }),
        new("Kimyon", new() { "çekirdek kimyon", "toz kimyon" }),
        new("Zerdeçal", new() { "taze zerdeçal", "toz zerdeçal", "turmeric" }),
        new("Kırmızı Biber", new() { "pul biber", "acı biber", "tatlı kırmızı biber tozu" }),
        new("Tarçın", new() { "çubuk tarçın", "toz tarçın", "cinnamon" }),
        new("Nane", new() { "taze nane", "kurutulmuş nane" }),

        // --- İçecek ve Destek Ailesi ---
        new("Su", new() { "maden suyu", "soda" }),
        new("Yeşil Çay", new() { "green tea", "matcha çayı" }),
        new("Siyah Çay", new() { "demlenmiş çay", "çay" }),
        new("Kahve", new() { "türk kahvesi", "filtre kahve", "espresso" }),
        new("Protein Tozu", new() { "whey protein", "whey", "çikolatalı protein tozu" }),
    };

    private record FamilyDef(string Name, string? Description, int SortOrder);

    private static List<FamilyDef> GetFamilyDefinitions() => new()
    {
        new("Yoğurt Ailesi",     "Yoğurt ve türevleri",          10),
        new("Süt Ailesi",         "Süt ve bitkisel süt alternatifleri", 20),
        new("Peynir Ailesi",      "Peynir çeşitleri",             30),
        new("Yumurta Ailesi",     "Yumurta çeşitleri",            40),
        new("Tahıl Ailesi",       "Tahıl ve tahıl ürünleri",      50),
        new("Ekmek Ailesi",       "Ekmek ve hamur ürünleri",      60),
        new("Meyve Ailesi",       "Taze meyveler",                70),
        new("Sebze Ailesi",       "Taze sebzeler",                80),
        new("Bakliyat Ailesi",    "Baklagiller ve bakliyat",      90),
        new("Et ve Tavuk Ailesi", "Kırmızı et ve tavuk eti",     100),
        new("Balık Ailesi",       "Balık ve deniz ürünleri",     110),
        new("Yağ ve Sos Ailesi",  "Yağlar ve soslar",            120),
        new("Kuruyemiş ve Tohum Ailesi", "Sert kabuklu meyveler ve tohumlar", 130),
        new("Baharat Ailesi",     "Baharatlar ve çeşniler",      140),
        new("İçecek ve Destek Ailesi", "İçecekler ve besin destekleri", 150),
    };

    // (familyName, canonicalName, role)
    private static List<(string FamilyName, string CanonicalName, IngredientFamilyMemberRole Role)> GetFamilyMemberDefinitions() => new()
    {
        // Yoğurt Ailesi
        ("Yoğurt Ailesi",         "Yoğurt",              IngredientFamilyMemberRole.Base),
        ("Yoğurt Ailesi",         "Meyveli Yoğurt",       IngredientFamilyMemberRole.Variant),
        ("Yoğurt Ailesi",         "Süzme Yoğurt",         IngredientFamilyMemberRole.Variant),
        ("Yoğurt Ailesi",         "Laktozsuz Yoğurt",     IngredientFamilyMemberRole.Variant),

        // Süt Ailesi
        ("Süt Ailesi",            "Süt",                  IngredientFamilyMemberRole.Base),
        ("Süt Ailesi",            "Laktozsuz Süt",        IngredientFamilyMemberRole.Variant),
        ("Süt Ailesi",            "Badem Sütü",           IngredientFamilyMemberRole.Variant),
        ("Süt Ailesi",            "Yulaf Sütü",           IngredientFamilyMemberRole.Variant),
        ("Süt Ailesi",            "Soya Sütü",            IngredientFamilyMemberRole.Variant),
        ("Süt Ailesi",            "Hindistan Cevizi Sütü", IngredientFamilyMemberRole.Variant),

        // Peynir Ailesi
        ("Peynir Ailesi",         "Beyaz Peynir",         IngredientFamilyMemberRole.Base),
        ("Peynir Ailesi",         "Kaşar Peyniri",        IngredientFamilyMemberRole.Variant),
        ("Peynir Ailesi",         "Cottage Cheese",       IngredientFamilyMemberRole.Derived),
        ("Peynir Ailesi",         "Ricotta",              IngredientFamilyMemberRole.Derived),
        ("Peynir Ailesi",         "Mozzarella",           IngredientFamilyMemberRole.Variant),

        // Yumurta Ailesi
        ("Yumurta Ailesi",        "Yumurta",              IngredientFamilyMemberRole.Base),
        ("Yumurta Ailesi",        "Bıldırcın Yumurtası",  IngredientFamilyMemberRole.Variant),

        // Tahıl Ailesi
        ("Tahıl Ailesi",          "Pirinç",               IngredientFamilyMemberRole.Base),
        ("Tahıl Ailesi",          "Esmer Pirinç",         IngredientFamilyMemberRole.Variant),
        ("Tahıl Ailesi",          "Makarna",              IngredientFamilyMemberRole.Base),
        ("Tahıl Ailesi",          "Tam Buğday Makarnası", IngredientFamilyMemberRole.Variant),
        ("Tahıl Ailesi",          "Yulaf Ezmesi",         IngredientFamilyMemberRole.Base),
        ("Tahıl Ailesi",          "Kinoa",                IngredientFamilyMemberRole.Variant),
        ("Tahıl Ailesi",          "Bulgur",               IngredientFamilyMemberRole.Variant),
        ("Tahıl Ailesi",          "Arpa",                 IngredientFamilyMemberRole.Variant),

        // Ekmek Ailesi
        ("Ekmek Ailesi",          "Beyaz Ekmek",          IngredientFamilyMemberRole.Base),
        ("Ekmek Ailesi",          "Tam Buğday Ekmeği",    IngredientFamilyMemberRole.Variant),
        ("Ekmek Ailesi",          "Pita Ekmeği",          IngredientFamilyMemberRole.Variant),
        ("Ekmek Ailesi",          "Çavdar Ekmeği",        IngredientFamilyMemberRole.Variant),

        // Meyve Ailesi
        ("Meyve Ailesi",          "Elma",                 IngredientFamilyMemberRole.Base),
        ("Meyve Ailesi",          "Muz",                  IngredientFamilyMemberRole.Base),
        ("Meyve Ailesi",          "Portakal",             IngredientFamilyMemberRole.Base),
        ("Meyve Ailesi",          "Çilek",                IngredientFamilyMemberRole.Base),
        ("Meyve Ailesi",          "Üzüm",                 IngredientFamilyMemberRole.Base),
        ("Meyve Ailesi",          "Kivi",                 IngredientFamilyMemberRole.Base),
        ("Meyve Ailesi",          "Şeftali",              IngredientFamilyMemberRole.Base),
        ("Meyve Ailesi",          "Armut",                IngredientFamilyMemberRole.Base),

        // Sebze Ailesi
        ("Sebze Ailesi",          "Domates",              IngredientFamilyMemberRole.Base),
        ("Sebze Ailesi",          "Salatalık",            IngredientFamilyMemberRole.Base),
        ("Sebze Ailesi",          "Havuç",                IngredientFamilyMemberRole.Base),
        ("Sebze Ailesi",          "Ispanak",              IngredientFamilyMemberRole.Base),
        ("Sebze Ailesi",          "Brokoli",              IngredientFamilyMemberRole.Base),
        ("Sebze Ailesi",          "Kapya Biber",          IngredientFamilyMemberRole.Base),
        ("Sebze Ailesi",          "Kabak",                IngredientFamilyMemberRole.Base),
        ("Sebze Ailesi",          "Soğan",                IngredientFamilyMemberRole.Base),
        ("Sebze Ailesi",          "Sarımsak",             IngredientFamilyMemberRole.Base),
        ("Sebze Ailesi",          "Patates",              IngredientFamilyMemberRole.Base),
        ("Sebze Ailesi",          "Patlıcan",             IngredientFamilyMemberRole.Base),
        ("Sebze Ailesi",          "Mısır",                IngredientFamilyMemberRole.Base),

        // Bakliyat Ailesi
        ("Bakliyat Ailesi",       "Mercimek",             IngredientFamilyMemberRole.Base),
        ("Bakliyat Ailesi",       "Nohut",                IngredientFamilyMemberRole.Base),
        ("Bakliyat Ailesi",       "Fasulye",              IngredientFamilyMemberRole.Base),
        ("Bakliyat Ailesi",       "Barbunya",             IngredientFamilyMemberRole.Variant),
        ("Bakliyat Ailesi",       "Bezelye",              IngredientFamilyMemberRole.Base),
        ("Bakliyat Ailesi",       "Edamame",              IngredientFamilyMemberRole.Variant),

        // Et ve Tavuk Ailesi
        ("Et ve Tavuk Ailesi",    "Tavuk Göğsü",          IngredientFamilyMemberRole.Base),
        ("Et ve Tavuk Ailesi",    "Tavuk But",            IngredientFamilyMemberRole.Variant),
        ("Et ve Tavuk Ailesi",    "Dana Kıyma",           IngredientFamilyMemberRole.Base),
        ("Et ve Tavuk Ailesi",    "Dana Eti",             IngredientFamilyMemberRole.Base),
        ("Et ve Tavuk Ailesi",    "Hindi Göğsü",          IngredientFamilyMemberRole.Variant),
        ("Et ve Tavuk Ailesi",    "Kuzu Eti",             IngredientFamilyMemberRole.Base),

        // Balık Ailesi
        ("Balık Ailesi",          "Somon",                IngredientFamilyMemberRole.Base),
        ("Balık Ailesi",          "Ton Balığı",           IngredientFamilyMemberRole.Base),
        ("Balık Ailesi",          "Hamsi",                IngredientFamilyMemberRole.Base),
        ("Balık Ailesi",          "Levrek",               IngredientFamilyMemberRole.Base),
        ("Balık Ailesi",          "Çipura",               IngredientFamilyMemberRole.Base),
        ("Balık Ailesi",          "Sardalya",             IngredientFamilyMemberRole.Base),

        // Yağ ve Sos Ailesi
        ("Yağ ve Sos Ailesi",     "Zeytinyağı",           IngredientFamilyMemberRole.Base),
        ("Yağ ve Sos Ailesi",     "Tereyağı",             IngredientFamilyMemberRole.Base),
        ("Yağ ve Sos Ailesi",     "Ayçiçek Yağı",         IngredientFamilyMemberRole.Variant),
        ("Yağ ve Sos Ailesi",     "Hindistan Cevizi Yağı", IngredientFamilyMemberRole.Variant),
        ("Yağ ve Sos Ailesi",     "Tahini",               IngredientFamilyMemberRole.Derived),
        ("Yağ ve Sos Ailesi",     "Yer Fıstığı Ezmesi",   IngredientFamilyMemberRole.Derived),

        // Kuruyemiş ve Tohum Ailesi
        ("Kuruyemiş ve Tohum Ailesi", "Badem",            IngredientFamilyMemberRole.Base),
        ("Kuruyemiş ve Tohum Ailesi", "Ceviz",            IngredientFamilyMemberRole.Base),
        ("Kuruyemiş ve Tohum Ailesi", "Fındık",           IngredientFamilyMemberRole.Base),
        ("Kuruyemiş ve Tohum Ailesi", "Kaju",             IngredientFamilyMemberRole.Base),
        ("Kuruyemiş ve Tohum Ailesi", "Chia Tohumu",      IngredientFamilyMemberRole.Base),
        ("Kuruyemiş ve Tohum Ailesi", "Keten Tohumu",     IngredientFamilyMemberRole.Base),
        ("Kuruyemiş ve Tohum Ailesi", "Ayçiçeği Çekirdeği", IngredientFamilyMemberRole.Base),
        ("Kuruyemiş ve Tohum Ailesi", "Susam",            IngredientFamilyMemberRole.Base),

        // Baharat Ailesi
        ("Baharat Ailesi",        "Tuz",                  IngredientFamilyMemberRole.Base),
        ("Baharat Ailesi",        "Karabiber",            IngredientFamilyMemberRole.Base),
        ("Baharat Ailesi",        "Kimyon",               IngredientFamilyMemberRole.Base),
        ("Baharat Ailesi",        "Zerdeçal",             IngredientFamilyMemberRole.Base),
        ("Baharat Ailesi",        "Kırmızı Biber",        IngredientFamilyMemberRole.Base),
        ("Baharat Ailesi",        "Tarçın",               IngredientFamilyMemberRole.Base),
        ("Baharat Ailesi",        "Nane",                 IngredientFamilyMemberRole.Base),

        // İçecek ve Destek Ailesi
        ("İçecek ve Destek Ailesi", "Su",                 IngredientFamilyMemberRole.Base),
        ("İçecek ve Destek Ailesi", "Yeşil Çay",          IngredientFamilyMemberRole.Base),
        ("İçecek ve Destek Ailesi", "Siyah Çay",          IngredientFamilyMemberRole.Base),
        ("İçecek ve Destek Ailesi", "Kahve",              IngredientFamilyMemberRole.Base),
        ("İçecek ve Destek Ailesi", "Protein Tozu",       IngredientFamilyMemberRole.Base),
    };

    // (requiredName, candidateName, CompatibilityType)
    private static List<(string RequiredName, string CandidateName, CompatibilityType Compat)> GetCompatibilityRuleDefinitions() => new()
    {
        // Yoğurt Ailesi — Required: Yoğurt
        ("Yoğurt", "Süzme Yoğurt",     CompatibilityType.SubstituteAllowed),
        ("Yoğurt", "Laktozsuz Yoğurt", CompatibilityType.SubstituteAllowed),
        ("Yoğurt", "Meyveli Yoğurt",   CompatibilityType.NotCompatible),

        // Süt Ailesi — Required: Süt
        ("Süt", "Laktozsuz Süt",         CompatibilityType.SubstituteAllowed),
        ("Süt", "Badem Sütü",            CompatibilityType.FamilyCompatible),
        ("Süt", "Yulaf Sütü",            CompatibilityType.FamilyCompatible),
        ("Süt", "Soya Sütü",             CompatibilityType.FamilyCompatible),
        ("Süt", "Hindistan Cevizi Sütü", CompatibilityType.FamilyCompatible),

        // Peynir Ailesi — Required: Beyaz Peynir
        ("Beyaz Peynir", "Cottage Cheese",  CompatibilityType.SubstituteAllowed),
        ("Beyaz Peynir", "Ricotta",         CompatibilityType.FamilyCompatible),
        ("Beyaz Peynir", "Kaşar Peyniri",   CompatibilityType.NotCompatible),

        // Tahıl Ailesi
        ("Pirinç",  "Esmer Pirinç",         CompatibilityType.SubstituteAllowed),
        ("Pirinç",  "Bulgur",               CompatibilityType.FamilyCompatible),
        ("Pirinç",  "Kinoa",                CompatibilityType.FamilyCompatible),
        ("Makarna", "Tam Buğday Makarnası", CompatibilityType.SubstituteAllowed),

        // Ekmek Ailesi
        ("Beyaz Ekmek", "Tam Buğday Ekmeği", CompatibilityType.SubstituteAllowed),
        ("Beyaz Ekmek", "Çavdar Ekmeği",     CompatibilityType.FamilyCompatible),
        ("Beyaz Ekmek", "Pita Ekmeği",       CompatibilityType.FamilyCompatible),

        // Et ve Tavuk Ailesi
        ("Tavuk Göğsü", "Tavuk But",    CompatibilityType.SubstituteAllowed),
        ("Tavuk Göğsü", "Hindi Göğsü", CompatibilityType.SubstituteAllowed),
        ("Dana Kıyma",  "Dana Eti",     CompatibilityType.FamilyCompatible),

        // Balık Ailesi
        ("Somon",     "Levrek",   CompatibilityType.FamilyCompatible),
        ("Somon",     "Çipura",   CompatibilityType.FamilyCompatible),
        ("Ton Balığı","Sardalya", CompatibilityType.FamilyCompatible),

        // Yağ Ailesi
        ("Zeytinyağı", "Ayçiçek Yağı",         CompatibilityType.SubstituteAllowed),
        ("Zeytinyağı", "Hindistan Cevizi Yağı", CompatibilityType.FamilyCompatible),
        ("Tereyağı",   "Hindistan Cevizi Yağı", CompatibilityType.SubstituteAllowed),

        // Bakliyat Ailesi
        ("Mercimek", "Nohut",     CompatibilityType.FamilyCompatible),
        ("Fasulye",  "Barbunya",  CompatibilityType.SubstituteAllowed),
        ("Fasulye",  "Edamame",   CompatibilityType.FamilyCompatible),

        // Kuruyemiş Ailesi
        ("Badem", "Kaju",   CompatibilityType.FamilyCompatible),
        ("Badem", "Ceviz",  CompatibilityType.FamilyCompatible),
        ("Badem", "Fındık", CompatibilityType.FamilyCompatible),
    };

    // =========================================================================
    // INGREDIENT PACKS SEEDING
    // =========================================================================

    private async Task SeedIngredientPacksAsync(AppDbContext db, Dictionary<string, Ingredient> allIngredients)
    {
        _logger.LogInformation("Seeding ingredient packs...");

        var packDefinitions = new List<(string Name, int SortOrder, List<string> Ingredients)>
        {
            ("Kahvaltılık Paket", 1, new()
            {
                "Yumurta", "Beyaz Peynir", "Kaşar Peyniri", "Zeytin", "Domates", "Salatalık",
                "Tam Buğday Ekmeği", "Beyaz Ekmek", "Tereyağı", "Süt", "Çay"
            }),
            ("Öğle Yemeği Paketi", 2, new()
            {
                "Tavuk Göğsü", "Pirinç", "Bulgur", "Mercimek", "Nohut",
                "Ispanak", "Brokoli", "Domates", "Salatalık", "Zeytinyağı"
            }),
            ("Akşam Yemeği Paketi", 3, new()
            {
                "Dana Eti", "Somon", "Tavuk Göğsü", "Patates", "Makarna",
                "Kabak", "Patlıcan", "Kapya Biber", "Soğan", "Sarımsak"
            }),
            ("Sağlıklı Atıştırmalık Paketi", 4, new()
            {
                "Badem", "Ceviz", "Fındık", "Kaju", "Yoğurt",
                "Elma", "Muz", "Çilek", "Chia Tohumu"
            }),
            ("Protein Paketi", 5, new()
            {
                "Yumurta", "Tavuk Göğsü", "Ton Balığı", "Somon", "Nohut",
                "Edamame", "Cottage Cheese", "Yoğurt", "Badem", "Kinoa"
            }),
            ("Fit Sebzeler Paketi", 6, new()
            {
                "Ispanak", "Brokoli", "Havuç", "Domates", "Salatalık",
                "Kabak", "Kapya Biber", "Patlıcan", "Mısır", "Bezelye"
            }),
        };

        var existingPacks = await db.IngredientPacks
            .Include(p => p.Items)
            .ToDictionaryAsync(p => p.Name);

        foreach (var (name, sortOrder, ingredientNames) in packDefinitions)
        {
            if (!existingPacks.TryGetValue(name, out var pack))
            {
                pack = new IngredientPack(Guid.NewGuid(), name, isSystem: true, sortOrder: sortOrder);
                db.IngredientPacks.Add(pack);
                existingPacks[name] = pack;
            }

            // Add missing items
            foreach (var ingName in ingredientNames)
            {
                if (!allIngredients.TryGetValue(ingName, out var ing)) continue;
                if (pack.Items.Any(item => item.IngredientId == ing.Id)) continue;
                pack.AddItem(new IngredientPackItem(pack.Id, ing.Id));
            }
        }

        await db.SaveChangesAsync();
        _logger.LogInformation("Ingredient pack seed complete.");
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private static async Task EnsureFamilyMember(AppDbContext db, Guid familyId, Guid ingredientId, IngredientFamilyMemberRole role)
    {
        var existing = await db.IngredientFamilyMembers
            .FirstOrDefaultAsync(m => m.FamilyId == familyId && m.IngredientId == ingredientId);

        if (existing == null)
            db.IngredientFamilyMembers.Add(new IngredientFamilyMember(familyId, ingredientId, role));
        else if (existing.Role != role)
            existing.UpdateRole(role);
    }

    private static async Task EnsureCompatibilityRule(AppDbContext db, Guid reqId, Guid candId, CompatibilityType type)
    {
        var existing = await db.IngredientCompatibilityRules
            .FirstOrDefaultAsync(r => r.RequiredIngredientId == reqId && r.CandidateIngredientId == candId);

        if (existing == null)
            db.IngredientCompatibilityRules.Add(new IngredientCompatibilityRule(Guid.NewGuid(), reqId, candId, type));
        else if (existing.CompatibilityType != type)
            existing.Update(type, existing.ScorePenalty, existing.Reason);
    }
}
