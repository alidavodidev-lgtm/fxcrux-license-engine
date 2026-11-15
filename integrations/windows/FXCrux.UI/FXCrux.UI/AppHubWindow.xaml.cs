using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace FXCrux.UI
{
    public partial class AppHubWindow : Window
    {
        private readonly EngineClient _engine;
        private string _pairingCode = "";
        private bool _actionInProgress = false;

        public AppHubWindow(EngineClient engine)
        {
            InitializeComponent();
            _engine = engine;
            Loaded += async (_, _) => await RefreshAppsAsync(showOverlay: true);
            // MainWindow is only Hidden (not Closed) once login succeeds, so it
            // stays alive in the background - without this, closing this window
            // via Alt+F4 (bypassing BtnClose_Click) would leave the process
            // running invisibly instead of actually exiting.
            Closed += (_, _) => Application.Current.Shutdown();
        }

        private void Window_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (e.ButtonState == MouseButtonState.Pressed) DragMove();
        }

        private void BtnClose_Click(object sender, RoutedEventArgs e) => Application.Current.Shutdown();

        private async void BtnRefresh_Click(object sender, RoutedEventArgs e) => await RefreshAppsAsync(showOverlay: true);

        // Root cause finally isolated: manual click + Ctrl+A + Ctrl+C on
        // TxtPairingCode always worked instantly and reliably, while our own
        // hand-rolled Clipboard.SetText(...) call from this button's handler
        // kept failing (traced live to third-party software on the dev
        // machine - an "Activator_NT8" tool and Internet Download Manager,
        // both known to grab the systemwide clipboard - but a customer's PC
        // could have similar clipboard-hooking software too, so this isn't a
        // one-off). Rather than keep re-implementing our own clipboard call
        // and hoping it behaves like the built-in one, this now drives the
        // exact same code path WPF's own TextBox uses for Ctrl+C
        // (ApplicationCommands.Copy) instead of calling Clipboard.SetText
        // ourselves - since that path is the one already proven reliable.
        private void BtnCopyPairing_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrEmpty(_pairingCode))
            {
                SetStatus("No pairing code yet - log in again to fetch one.", Brushes.OrangeRed);
                return;
            }

            TxtPairingCode.Focus();
            TxtPairingCode.SelectAll();
            ApplicationCommands.Copy.Execute(null, TxtPairingCode);
            SetStatus("Pairing code copied to clipboard.", Brushes.LightGreen);
        }

        // preserveStatus=true is used right after Download/Install/Update/Open:
        // the caller already set a real result message (success or a specific
        // failure reason) that the user needs to actually read - overwriting
        // it with a generic "Loading..."/"Ready." a split second later made
        // every action's outcome invisible, including genuine failures, which
        // was hiding the real cause behind confusing "nothing happened"
        // reports (e.g. Download silently failing looked identical to it
        // succeeding, from the user's side).
        private async Task RefreshAppsAsync(bool showOverlay, bool preserveStatus = false)
        {
            if (showOverlay) LoadingOverlay.Visibility = Visibility.Visible;
            if (!preserveStatus) SetStatus("Loading your licensed apps...", Brushes.Cyan);
            try
            {
                var result = await _engine.ListAppsAsync();
                if (!result.Ok)
                {
                    if (!preserveStatus) SetStatus("Could not load your apps.", Brushes.OrangeRed);
                    return;
                }

                TxtUsername.Text = result.Username;
                TxtMachineId.Text = $"Machine: {Mask(result.MachineId)}";
                _pairingCode = result.PairingSecret ?? "";
                bool hasPairingCode = !string.IsNullOrEmpty(_pairingCode);
                TxtPairingCode.Text = hasPairingCode ? _pairingCode : "Not available - log in again";
                BtnCopyPairing.IsEnabled = hasPairingCode;
                BtnCopyPairing.Opacity = hasPairingCode ? 1.0 : 0.4;

                AppListPanel.Children.Clear();
                if (result.Apps.Count == 0)
                {
                    var empty = new TextBlock
                    {
                        Text = "No licensed apps yet. Purchase one on the Command Center.",
                        Foreground = Brushes.Gray,
                        FontSize = 13,
                        TextWrapping = TextWrapping.Wrap,
                        Margin = new Thickness(0, 20, 0, 0),
                    };
                    AppListPanel.Children.Add(empty);
                }
                else
                {
                    foreach (var app in result.Apps)
                        AppListPanel.Children.Add(BuildAppCard(app));
                }

                if (!preserveStatus) SetStatus("Ready.", Brushes.Gray);
            }
            catch (Exception ex)
            {
                if (!preserveStatus) SetStatus($"Connection error: {ex.Message}", Brushes.OrangeRed);
            }
            finally
            {
                LoadingOverlay.Visibility = Visibility.Collapsed;
            }
        }

        private static string Mask(string machineId)
        {
            if (string.IsNullOrEmpty(machineId) || machineId.Length <= 10) return machineId;
            return machineId.Substring(0, 6) + "…" + machineId.Substring(machineId.Length - 4);
        }

        private Border BuildAppCard(AppInfo app)
        {
            bool unavailable = app.ButtonState == "unavailable";

            var card = new Border
            {
                Background = new SolidColorBrush(Color.FromRgb(0x00, 0x00, 0x00)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(0x26, 0x26, 0x26)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(14),
                Margin = new Thickness(0, 0, 0, 12),
                Opacity = unavailable ? 0.55 : 1.0,
            };

            var grid = new Grid();
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            var icon = new Image { Width = 48, Height = 48, Margin = new Thickness(0, 0, 14, 0) };
            RenderOptions.SetBitmapScalingMode(icon, BitmapScalingMode.HighQuality);
            TrySetIcon(icon, app.IconUrl);
            Grid.SetColumn(icon, 0);
            grid.Children.Add(icon);

            var infoPanel = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
            infoPanel.Children.Add(new TextBlock
            {
                Text = app.Product,
                Foreground = Brushes.White,
                FontWeight = FontWeights.Bold,
                FontSize = 16,
            });

            string subtitle = unavailable
                ? "No version published yet"
                : $"{(app.Platform ?? "").ToUpperInvariant()} · v{app.Version} {(app.ExpiresAt != null ? "· expires " + FormatDate(app.ExpiresAt) : "")}";
            infoPanel.Children.Add(new TextBlock
            {
                Text = subtitle,
                Foreground = new SolidColorBrush(Color.FromRgb(0xCC, 0xA6, 0x33)),
                FontSize = 13,
                Margin = new Thickness(0, 3, 0, 0),
            });
            if (!string.IsNullOrEmpty(app.Description))
            {
                infoPanel.Children.Add(new TextBlock
                {
                    Text = app.Description,
                    Foreground = new SolidColorBrush(Color.FromRgb(0xA0, 0xA0, 0xA0)),
                    FontSize = 12,
                    TextWrapping = TextWrapping.Wrap,
                    Margin = new Thickness(0, 5, 0, 0),
                    MaxWidth = 280,
                });
            }
            Grid.SetColumn(infoPanel, 1);
            grid.Children.Add(infoPanel);

            var button = BuildActionButton(app);
            Grid.SetColumn(button, 2);
            grid.Children.Add(button);

            card.Child = grid;
            return card;
        }

        private static string FormatDate(string? iso)
        {
            if (iso != null && DateTime.TryParse(iso, out var dt)) return dt.ToString("yyyy-MM-dd");
            return "";
        }

        private static void TrySetIcon(Image image, string? iconUrl)
        {
            try
            {
                if (!string.IsNullOrEmpty(iconUrl))
                {
                    var bmp = new BitmapImage();
                    bmp.BeginInit();
                    bmp.UriSource = new Uri(iconUrl, UriKind.Absolute);
                    bmp.CacheOption = BitmapCacheOption.OnLoad;
                    bmp.EndInit();
                    image.Source = bmp;
                    return;
                }
            }
            catch { /* fall through to the placeholder */ }

            image.Source = new BitmapImage(new Uri("pack://application:,,,/Resources/LogoMark.png"));
        }

        private Button BuildActionButton(AppInfo app)
        {
            var (label, enabled) = app.ButtonState switch
            {
                "download" => ("DOWNLOAD", true),
                "install" => ("INSTALL", true),
                "update" => ("UPDATE", true),
                "open" => ("OPEN", true),
                "installed" => ("INSTALLED", false),
                "unavailable" => ("UNAVAILABLE", false),
                _ => ("—", false),
            };

            var button = new Button
            {
                Content = label,
                Width = 104,
                Height = 38,
                FontSize = 12,
                FontWeight = FontWeights.Black,
                Background = enabled ? new SolidColorBrush(Color.FromRgb(0xD4, 0xAF, 0x37)) : new SolidColorBrush(Color.FromRgb(0x1A, 0x1A, 0x1A)),
                Foreground = enabled ? Brushes.Black : Brushes.Gray,
                BorderBrush = Brushes.Transparent,
                IsEnabled = enabled,
                Cursor = enabled ? Cursors.Hand : Cursors.Arrow,
            };

            button.Click += async (_, _) => await HandleActionAsync(app, button);
            return button;
        }

        private async Task HandleActionAsync(AppInfo app, Button button)
        {
            if (_actionInProgress) return;
            _actionInProgress = true;

            DisableAllActionButtons();
            button.Content = "···";

            try
            {
                bool ok;
                string message;
                switch (app.ButtonState)
                {
                    case "download":
                        SetStatus($"Downloading {app.Product}...", Brushes.Cyan);
                        var downloadResult = await _engine.DownloadAsync(app.Product);
                        (ok, message) = (downloadResult.Ok, downloadResult.Message);
                        break;
                    case "update":
                        SetStatus($"Updating {app.Product}...", Brushes.Cyan);
                        var updateDownload = await _engine.DownloadAsync(app.Product);
                        if (!updateDownload.Ok || (app.Platform ?? "").ToLowerInvariant() == "exe")
                            (ok, message) = (updateDownload.Ok, updateDownload.Message);
                        else
                            (ok, message) = await InstallWithPickerAsync(app);
                        break;
                    case "install":
                        SetStatus($"Installing {app.Product}...", Brushes.Cyan);
                        (ok, message) = await InstallWithPickerAsync(app);
                        break;
                    case "open":
                        var openResult = await _engine.OpenAsync(app.Product);
                        (ok, message) = (openResult.Ok, openResult.Message);
                        break;
                    default:
                        return;
                }

                SetStatus(message, ok ? Brushes.LightGreen : Brushes.OrangeRed);
            }
            catch (Exception ex)
            {
                SetStatus($"Error: {ex.Message}", Brushes.OrangeRed);
            }
            finally
            {
                _actionInProgress = false;
                // No need to manually restore button state - RefreshAppsAsync
                // rebuilds every card from scratch off the Engine's fresh answer.
                // preserveStatus: true keeps the real result message (success or
                // the specific failure reason) on screen instead of the refresh
                // silently overwriting it with "Loading.../Ready." a moment later.
                await RefreshAppsAsync(showOverlay: false, preserveStatus: true);
            }
        }

        // Calls Install; if the Engine reports it needs the user to pick which
        // broker terminal(s) to target (first-time MT4/MT5 install with more
        // than one detected terminal), shows the picker and re-issues the call
        // with the chosen terminal IDs. An update-in-place (terminals that
        // already have this product) never hits NeedsSelection - the Engine
        // auto-targets those without asking.
        private async Task<(bool Ok, string Message)> InstallWithPickerAsync(AppInfo app)
        {
            var result = await _engine.InstallAsync(app.Product);
            if (!result.NeedsSelection) return (result.Ok, result.Message);

            var picker = new TerminalPickerWindow(result.Terminals) { Owner = this };
            bool? pickerResult = picker.ShowDialog();
            if (pickerResult != true) return (false, "Install cancelled.");

            var finalResult = await _engine.InstallAsync(app.Product, picker.SelectedTerminalIds);
            return (finalResult.Ok, finalResult.Message);
        }

        private void DisableAllActionButtons()
        {
            foreach (var child in AppListPanel.Children)
            {
                if (child is Border card && card.Child is Grid grid)
                {
                    foreach (var gridChild in grid.Children)
                    {
                        if (gridChild is Button btn) btn.IsEnabled = false;
                    }
                }
            }
        }

        private void SetStatus(string text, Brush color)
        {
            TxtStatus.Text = text;
            TxtStatus.Foreground = color;
        }
    }
}
