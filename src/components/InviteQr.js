import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

import { createInviteMatrix } from '../services/inviteQrImage';

/**
 * Renders black modules on white in both themes, including a white quiet zone.
 */
export default function InviteQr({ value, maxSize = 224 }) {
  const matrix = useMemo(() => createInviteMatrix(value), [value]);
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
                backgroundColor: '#000000',
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
