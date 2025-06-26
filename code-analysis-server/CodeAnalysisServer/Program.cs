using CodeAnalysisServer.Api.Interfaces;
using CodeAnalysisServer.Services;

var builder = WebApplication.CreateBuilder(args);

// Kestrel ポート指定
builder.WebHost.ConfigureKestrel(options =>
{
    // 6000番ポートで Listen
    options.ListenAnyIP(6000);
});

// サービスの追加

// サービスの登録
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<ICompletionProvider, CompletionProvider>();
builder.Services.AddSingleton<ICodeCheckProvider, CodeCheckProvider>();
builder.Services.AddSingleton<IHoverInformationProvider, HoverInformationProvider>();
builder.Services.AddSingleton<ISignatureHelpProvider, SignatureHelpProvider>();
builder.Services.AddSingleton<ITabCompletionProvider, TabCompletionProvider>();
builder.Services.AddSingleton<ICodeFixProvider, CodeFixProvider>();
builder.Services.AddSingleton<IAssemblyProvider>(new AssemblyProvider());

// コントローラーの追加
builder.Services.AddControllers();

// Swaggerサービスの追加
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORSポリシーの設定
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy =>
        {
            policy.WithOrigins("http://localhost:3000")
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});

var app = builder.Build();

// ミドルウェアの設定

// CORSポリシーの適用
app.UseCors("AllowReactApp");

// Swaggerの設定
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// 認証・認可ミドルウェア
app.UseAuthorization();

// コントローラーエンドポイントのマッピング
app.MapControllers();

await app.RunAsync();