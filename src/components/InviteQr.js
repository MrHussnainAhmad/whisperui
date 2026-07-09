import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';

const QRCode = require('qrcode-terminal/vendor/QRCode');
const QRErrorCorrectLevel = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

function createMatrix(value) {
  const qr = new QRCode(-1, QRErrorCorrectLevel.M);
  qr.addData(value);
  qr.make();
  return qr.modules;
}

/**
 * Renders an invite QR. Module color adapts to the active theme; the quiet zone
 * stays white in both themes so every phone's stock scanner can read it.
 */
export default function InviteQr({ value, maxSize = 224 }) {
  const { colors } = useTheme();
  const matrix = useMemo(() => createMatrix(value), [value]);
  const quietModules = 4;
  const moduleSize = Math.max(3, Math.floor(maxSize / (matrix.length + quietModules * 2)));
  const matrixSize = matrix.length * moduleSize;
  const quietSize = quietModules * moduleSize;
  const totalSize = matrixSize + quietSize * 2;

  return (
    <View
      accessible
      accessibilityLabel="Secure invite QR code"
      style={[s.quietZone, { width: totalSize, height: totalSize, padding: quietSize }]}
    >
      <View style={{ width: matrixSize, height: matrixSize }}>
        {matrix.flatMap((row, rowIndex) => row.map((dark, columnIndex) => dark && (
          <View
            key={`${rowIndex}-${columnIndex}`}
            style={[
              s.module,
              {
                width: moduleSize,
                height: moduleSize,
                left: columnIndex * moduleSize,
                top: rowIndex * moduleSize,
                backgroundColor: colors.qrForeground,
              },
            ]}
          />
        )))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  quietZone: { backgroundColor: '#FFFFFF' },
  module: { position: 'absolute' },
});
