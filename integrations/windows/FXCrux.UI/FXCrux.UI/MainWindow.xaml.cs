using System;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;

namespace FXCrux.UI
{
    public partial class MainWindow : Window
    {
        private EngineClient? _engine;

        public MainWindow()
        {
            InitializeComponent();
        }

        private void Window_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (e.ButtonState == MouseButtonState.Pressed)
                DragMove();
        }

        private void BtnClose_Click(object sender, RoutedEventArgs e)
        {
            Application.Current.Shutdown();
        }

        private async void BtnLogin_Click(object sender, RoutedEventArgs e)
        {
            string username = TxtUsername.Text.Trim();
            string password = TxtPassword.Password.Trim();

            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
            {
                TxtStatus.Text = "Please enter both Username and Password.";
                TxtStatus.Foreground = Brushes.Yellow;
                return;
            }

            TxtStatus.Text = "Authenticating with secure server...";
            TxtStatus.Foreground = Brushes.Cyan;
            BtnLogin.IsEnabled = false;
            LoadingOverlay.Visibility = Visibility.Visible;

            try
            {
                _engine = new EngineClient();
                await _engine.ConnectAsync(3000);

                var result = await _engine.LoginAsync(username, password);

                if (result.Ok)
                {
                    TxtStatus.Text = "✅ ACCESS GRANTED. HARDWARE BOUND.";
                    TxtStatus.Foreground = Brushes.LightGreen;

                    TxtUsername.IsEnabled = false;
                    TxtPassword.IsEnabled = false;
                    BtnLogin.Content = "SESSION ACTIVE";
                    BtnLogin.Background = Brushes.DarkGreen;
                    BtnLogin.Foreground = Brushes.White;

                    var appHub = new AppHubWindow(_engine);
                    appHub.Show();
                    Hide();
                }
                else
                {
                    TxtStatus.Text = result.Message;
                    TxtStatus.Foreground = Brushes.OrangeRed;
                    BtnLogin.IsEnabled = true;
                    await _engine.DisposeAsync();
                    _engine = null;
                }
            }
            catch (TimeoutException)
            {
                TxtStatus.Text = "❌ ENGINE NOT RUNNING. Start FXCrux Core.";
                TxtStatus.Foreground = Brushes.Red;
                BtnLogin.IsEnabled = true;
            }
            catch (Exception)
            {
                TxtStatus.Text = "❌ Connection Error!";
                TxtStatus.Foreground = Brushes.Red;
                BtnLogin.IsEnabled = true;
            }
            finally
            {
                LoadingOverlay.Visibility = Visibility.Collapsed;
            }
        }
    }
}