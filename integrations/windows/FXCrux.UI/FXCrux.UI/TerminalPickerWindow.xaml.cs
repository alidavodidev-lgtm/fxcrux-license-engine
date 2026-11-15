using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;

namespace FXCrux.UI
{
    public partial class TerminalPickerWindow : Window
    {
        public List<string> SelectedTerminalIds { get; private set; } = new();

        public TerminalPickerWindow(List<TerminalDto> terminals)
        {
            InitializeComponent();

            foreach (var terminal in terminals)
            {
                var checkbox = new CheckBox
                {
                    Content = terminal.BrokerLabel,
                    Tag = terminal.TerminalId,
                    Foreground = Brushes.White,
                    FontSize = 12,
                    Margin = new Thickness(4, 6, 4, 6),
                    IsChecked = true,
                };
                TerminalListPanel.Children.Add(checkbox);
            }
        }

        private void Window_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (e.ButtonState == MouseButtonState.Pressed) DragMove();
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }

        private void BtnInstall_Click(object sender, RoutedEventArgs e)
        {
            SelectedTerminalIds = TerminalListPanel.Children
                .OfType<CheckBox>()
                .Where(cb => cb.IsChecked == true)
                .Select(cb => (string)cb.Tag)
                .ToList();

            DialogResult = SelectedTerminalIds.Count > 0;
            Close();
        }
    }
}
